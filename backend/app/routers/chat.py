import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.chat import ChatSession, ChatMessage
from app.models.learning import Lesson, LearningPath
from app.models.analytics import HintUsageEvent
from app.schemas.chat import ChatRequest, ChatResponse, ChatSessionResponse, ChatMessageResponse, SuggestedLesson
from app.agents.socratic_mentor import SocraticMentorAgent
from app.agents.lesson_suggester import LessonSuggesterAgent
from app.agents.planner import PlannerAgent
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/send", response_model=ChatResponse)
async def send_message(
    data: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get or create session; build history without lazy-loading the relationship
    if data.session_id:
        result = await db.execute(
            select(ChatSession)
            .options(selectinload(ChatSession.messages))
            .where(ChatSession.id == data.session_id, ChatSession.user_id == current_user.id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        history = [{"role": m.role, "content": m.content} for m in session.messages]
    else:
        session = ChatSession(
            user_id=current_user.id,
            lesson_id=data.lesson_id,
            context="lesson" if data.lesson_id else "general",
        )
        db.add(session)
        await db.flush()
        history = []

    # Build rich lesson context so the mentor knows exactly what this lesson covers
    lesson_context = None
    if data.lesson_id:
        lesson_result = await db.execute(select(Lesson).where(Lesson.id == data.lesson_id))
        lesson = lesson_result.scalar_one_or_none()
        if lesson:
            parts = [f"Lesson: {lesson.title}", f"Topic: {lesson.topic}", f"Difficulty: {lesson.difficulty}"]
            if lesson.description:
                parts.append(f"Description: {lesson.description}")
            if lesson.content:
                expl = lesson.content.get("explanation", "")
                if expl:
                    parts.append(f"Explanation (first 600 chars): {expl[:600]}")
                concepts = lesson.content.get("key_concepts", [])
                if concepts:
                    parts.append(f"Key concepts: {', '.join(concepts)}")
            # Include the source code the lesson is based on
            path_result = await db.execute(
                select(LearningPath).where(LearningPath.id == lesson.learning_path_id)
            )
            path = path_result.scalar_one_or_none()
            if path and path.source_code:
                parts.append(f"Student's original code:\n```\n{path.source_code[:800]}\n```")
            lesson_context = "\n".join(parts)

    # Get AI response
    mentor = SocraticMentorAgent()
    response_text = await mentor.chat(
        user_message=data.message,
        conversation_history=history,
        lesson_context=lesson_context,
        code_context=data.code_context,
        hint_level=data.hint_level,
        skill_level=current_user.skill_level,
        weak_areas=current_user.weak_areas,
        current_frame=data.current_frame,
        is_checkpoint=data.is_checkpoint,
    )

    # Save messages
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=data.message,
        extra={"code_context": bool(data.code_context)},
    )
    ai_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=response_text,
        extra={"hint_level": data.hint_level},
    )
    db.add(user_msg)
    db.add(ai_msg)
    await db.flush()

    # ── AC-SGS-006: log hint usage event ────────────────────────────────────
    # Derive topic from the lesson if available, otherwise leave None
    hint_topic: str | None = None
    if data.lesson_id:
        lesson_result_topic = await db.execute(select(Lesson).where(Lesson.id == data.lesson_id))
        _lesson_for_topic = lesson_result_topic.scalar_one_or_none()
        if _lesson_for_topic:
            hint_topic = _lesson_for_topic.topic

    hint_event = HintUsageEvent(
        user_id=current_user.id,
        lesson_id=data.lesson_id,
        session_id=session.id,
        hint_level=data.hint_level if data.hint_level is not None else 0,
        topic=hint_topic,
    )
    db.add(hint_event)
    await db.flush()  # make the event visible to the COUNT query below

    # ── AC-GAP-003: auto-remedial workshop after 3 high-level hints on same topic ──
    if (data.hint_level or 0) >= 2 and hint_topic and data.lesson_id:
        try:
            count_result = await db.execute(
                select(func.count(HintUsageEvent.id)).where(
                    HintUsageEvent.user_id == current_user.id,
                    HintUsageEvent.topic == hint_topic,
                    HintUsageEvent.hint_level >= 2,
                )
            )
            high_hint_count = count_result.scalar() or 0
            if high_hint_count >= 3:
                existing_r = await db.execute(
                    select(Lesson)
                    .join(LearningPath, Lesson.learning_path_id == LearningPath.id)
                    .where(
                        LearningPath.user_id == current_user.id,
                        Lesson.topic == hint_topic,
                        Lesson.is_remedial == True,
                    )
                )
                if not existing_r.scalar_one_or_none():
                    gap_lesson_r = await db.execute(select(Lesson).where(Lesson.id == data.lesson_id))
                    gap_lesson = gap_lesson_r.scalar_one_or_none()
                    if gap_lesson:
                        gap_path_r = await db.execute(
                            select(LearningPath).where(LearningPath.id == gap_lesson.learning_path_id)
                        )
                        gap_path = gap_path_r.scalar_one_or_none()
                        if gap_path:
                            max_idx_r = await db.execute(
                                select(func.max(Lesson.order_index)).where(
                                    Lesson.learning_path_id == gap_path.id
                                )
                            )
                            max_idx = max_idx_r.scalar() or 0
                            planner = PlannerAgent()
                            content = await planner.generate_lesson_content(
                                topic=hint_topic,
                                title=f"Mastering {hint_topic.replace('_', ' ').title()}",
                                language=gap_path.language,
                                skill_level=current_user.skill_level,
                                code_snippet=(gap_path.source_code or "")[:1000],
                                weak_areas=[hint_topic],
                            )
                            remedial = Lesson(
                                learning_path_id=gap_path.id,
                                title=f"Mastering {hint_topic.replace('_', ' ').title()}",
                                topic=hint_topic,
                                description=(
                                    f"Targeted practice on {hint_topic.replace('_', ' ')} "
                                    "— automatically created after repeated hints on this topic."
                                ),
                                order_index=max_idx + 1,
                                estimated_minutes=20,
                                difficulty=current_user.skill_level,
                                content=content,
                                is_remedial=True,
                            )
                            db.add(remedial)
                            await db.flush()
                            gap_path.total_lessons = max_idx + 1
                            logger.info(
                                "AC-GAP-003: auto-remedial lesson created for topic '%s' (user %s)",
                                hint_topic, current_user.id,
                            )
        except Exception as exc:
            logger.warning("AC-GAP-003 auto-remedial lesson failed: %s", exc)

    # ── Hint-3 lesson suggestion ─────────────────────────────────────────────
    # When a student needed a full worked example, analyse the gap and create
    # a targeted mini-lesson so they can go deeper on that specific concept.
    suggested_lesson_out: SuggestedLesson | None = None
    if data.hint_level == 3 and data.lesson_id:
        try:
            conv_so_far = history + [
                {"role": "user", "content": data.message},
                {"role": "assistant", "content": response_text},
            ]
            suggester = LessonSuggesterAgent()
            spec = await suggester.suggest(conv_so_far, lesson_context)
            if spec:
                # Find the learning path to attach the new lesson to
                lesson_result2 = await db.execute(select(Lesson).where(Lesson.id == data.lesson_id))
                base_lesson = lesson_result2.scalar_one_or_none()
                if base_lesson:
                    path_id = base_lesson.learning_path_id
                    path_result2 = await db.execute(select(LearningPath).where(LearningPath.id == path_id))
                    path = path_result2.scalar_one_or_none()

                    # Get next order_index for this path
                    max_idx_result = await db.execute(
                        select(func.max(Lesson.order_index)).where(Lesson.learning_path_id == path_id)
                    )
                    max_idx = max_idx_result.scalar() or 0

                    # Generate content via Planner
                    planner = PlannerAgent()
                    source_code = (path.source_code or "") if path else ""
                    content = await planner.generate_lesson_content(
                        topic=spec["topic"],
                        title=spec["title"],
                        language=path.language if path else "python",
                        skill_level=current_user.skill_level,
                        code_snippet=source_code[:1000],
                        weak_areas=[spec["topic"]],
                    )

                    new_lesson = Lesson(
                        learning_path_id=path_id,
                        title=spec["title"],
                        topic=spec["topic"],
                        description=spec.get("description"),
                        order_index=max_idx + 1,
                        estimated_minutes=spec.get("estimated_minutes", 15),
                        difficulty=spec.get("difficulty", "beginner"),
                        content=content,
                    )
                    db.add(new_lesson)
                    await db.flush()

                    # Update path total
                    if path:
                        path.total_lessons = max_idx + 1
                    await db.refresh(new_lesson)

                    suggested_lesson_out = SuggestedLesson(
                        id=new_lesson.id,
                        title=new_lesson.title,
                        topic=new_lesson.topic,
                        description=new_lesson.description,
                        why=spec.get("why"),
                        learning_path_id=path_id,
                    )
                    logger.info("Created remedial lesson '%s' for user %s", new_lesson.title, current_user.id)
        except Exception as exc:
            logger.warning("Hint-3 lesson suggestion failed: %s", exc)

    await db.commit()
    await db.refresh(ai_msg)

    return ChatResponse(
        session_id=session.id,
        message=ChatMessageResponse.model_validate(ai_msg),
        hint_level_used=data.hint_level,
        suggested_lesson=suggested_lesson_out,
    )


@router.get("/stream")
async def stream_message(
    message: str,
    session_id: str | None = None,
    lesson_id: str | None = None,
    hint_level: int = 0,
    code_context: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    history = []
    lesson_context = None

    if session_id:
        result = await db.execute(
            select(ChatSession)
            .options(selectinload(ChatSession.messages))
            .where(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        )
        session = result.scalar_one_or_none()
        if session:
            history = [{"role": m.role, "content": m.content} for m in session.messages[-20:]]

    if lesson_id:
        lesson_result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
        lesson = lesson_result.scalar_one_or_none()
        if lesson:
            lesson_context = f"{lesson.title} ({lesson.topic})"

    async def event_stream():
        full_response = ""
        mentor = SocraticMentorAgent()
        async for chunk in mentor.stream_chat(
            user_message=message,
            conversation_history=history,
            lesson_context=lesson_context,
            code_context=code_context,
            hint_level=hint_level,
            skill_level=current_user.skill_level,
            weak_areas=current_user.weak_areas,
        ):
            full_response += chunk
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"

        # Save to DB after stream completes
        if session_id:
            user_msg = ChatMessage(session_id=session_id, role="user", content=message)
            ai_msg = ChatMessage(
                session_id=session_id,
                role="assistant",
                content=full_response,
                extra={"hint_level": hint_level},
            )
            db.add(user_msg)
            db.add(ai_msg)

            # AC-SGS-006: log hint usage event for the stream path
            stream_topic: str | None = None
            if lesson_id:
                lesson_res = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
                _lesson = lesson_res.scalar_one_or_none()
                if _lesson:
                    stream_topic = _lesson.topic
            db.add(HintUsageEvent(
                user_id=current_user.id,
                lesson_id=lesson_id,
                session_id=session_id,
                hint_level=hint_level,
                topic=stream_topic,
            ))
            await db.commit()

        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/session/{session_id}", response_model=ChatSessionResponse)
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return ChatSessionResponse.model_validate(session)
