import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db, AsyncSessionLocal
from app.models.user import User
from app.models.chat import ChatSession, ChatMessage
from app.models.learning import Lesson, LearningPath
from app.models.analytics import HintUsageEvent
from app.schemas.chat import (
    ChatRequest, ChatResponse, ChatSessionResponse, ChatMessageResponse, SuggestedLesson,
    ProposalAcceptRequest, ProposalRejectRequest
)
from app.agents.socratic_mentor import SocraticMentorAgent
from app.agents.lesson_suggester import LessonSuggesterAgent
from app.agents.planner import PlannerAgent
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

async def create_remedial_lesson_task(
    user_id: str,
    lesson_id: str,
    topic: str,
    skill_level: str,
):
    """Background task to create a remedial lesson (AC-GAP-003)."""
    async with AsyncSessionLocal() as db:
        try:
            # Check if already exists
            existing_r = await db.execute(
                select(Lesson)
                .join(LearningPath, Lesson.learning_path_id == LearningPath.id)
                .where(
                    LearningPath.user_id == user_id,
                    Lesson.topic == topic,
                    Lesson.is_remedial == True,
                )
            )
            if existing_r.scalar_one_or_none():
                return

            gap_lesson_r = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
            gap_lesson = gap_lesson_r.scalar_one_or_none()
            if not gap_lesson:
                return

            gap_path_r = await db.execute(
                select(LearningPath).where(LearningPath.id == gap_lesson.learning_path_id)
            )
            gap_path = gap_path_r.scalar_one_or_none()
            if not gap_path:
                return

            # Concurrency/Race condition fix: Get max index inside the same transaction
            max_idx_r = await db.execute(
                select(func.max(Lesson.order_index)).where(
                    Lesson.learning_path_id == gap_path.id
                )
            )
            max_idx = max_idx_r.scalar() or 0
            
            planner = PlannerAgent()
            content = await planner.generate_lesson_content(
                topic=topic,
                title=f"Mastering {topic.replace('_', ' ').title()}",
                language=gap_path.language,
                skill_level=skill_level,
                code_snippet=(gap_path.source_code or "")[:1000],
                weak_areas=[topic],
            )
            remedial = Lesson(
                learning_path_id=gap_path.id,
                title=f"Mastering {topic.replace('_', ' ').title()}",
                topic=topic,
                description=(
                    f"Targeted practice on {topic.replace('_', ' ')} "
                    "— automatically created after repeated hints on this topic."
                ),
                order_index=max_idx + 1,
                estimated_minutes=20,
                difficulty=skill_level,
                content=content,
                is_remedial=True,
            )
            db.add(remedial)
            gap_path.total_lessons = max_idx + 1
            await db.commit()
            logger.info("AC-GAP-003: auto-remedial lesson created for topic '%s' (user %s)", topic, user_id)
        except Exception as exc:
            logger.warning("AC-GAP-003 auto-remedial lesson failed: %s", exc)

async def create_hint3_suggestion_task(
    user_id: str,
    lesson_id: str,
    message: str,
    response_text: str,
    history: list,
    lesson_context: str | None,
    skill_level: str,
):
    """Background task to analyze conversation for gap-filling mini-lessons."""
    async with AsyncSessionLocal() as db:
        try:
            conv_so_far = history + [
                {"role": "user", "content": message},
                {"role": "assistant", "content": response_text},
            ]
            suggester = LessonSuggesterAgent()
            spec = await suggester.suggest(conv_so_far, lesson_context)
            if spec:
                lesson_result2 = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
                base_lesson = lesson_result2.scalar_one_or_none()
                if not base_lesson:
                    return

                path_id = base_lesson.learning_path_id
                path_result2 = await db.execute(select(LearningPath).where(LearningPath.id == path_id))
                path = path_result2.scalar_one_or_none()
                if not path:
                    return

                max_idx_result = await db.execute(
                    select(func.max(Lesson.order_index)).where(Lesson.learning_path_id == path_id)
                )
                max_idx = max_idx_result.scalar() or 0

                planner = PlannerAgent()
                source_code = (path.source_code or "") if path else ""
                content = await planner.generate_lesson_content(
                    topic=spec["topic"],
                    title=spec["title"],
                    language=path.language if path else "python",
                    skill_level=skill_level,
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
                path.total_lessons = max_idx + 1
                await db.commit()
                logger.info("Created remedial lesson '%s' for user %s", new_lesson.title, user_id)
        except Exception as exc:
            logger.warning("Hint-3 lesson suggestion failed: %s", exc)


@router.post("/send", response_model=ChatResponse)
async def send_message(
    data: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get or create session
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

    # Build lesson context
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
        suggestion_count=session.suggestion_count,
        rejected_topics=session.rejected_topics,
    )

    # Check if a proposal was made and increment count
    if "```proposal" in response_text:
        session.suggestion_count += 1

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

    # Log hint usage
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
    await db.flush()

    # ── AC-GAP-003: Trigger background remedial task ──
    if (data.hint_level or 0) >= 2 and hint_topic and data.lesson_id:
        count_result = await db.execute(
            select(func.count(HintUsageEvent.id)).where(
                HintUsageEvent.user_id == current_user.id,
                HintUsageEvent.topic == hint_topic,
                HintUsageEvent.hint_level >= 2,
            )
        )
        high_hint_count = count_result.scalar() or 0
        if high_hint_count >= 3:
            background_tasks.add_task(
                create_remedial_lesson_task,
                user_id=current_user.id,
                lesson_id=data.lesson_id,
                topic=hint_topic,
                skill_level=current_user.skill_level,
            )

    # ── Hint-3 Suggestion background task ──
    if data.hint_level == 3 and data.lesson_id:
        background_tasks.add_task(
            create_hint3_suggestion_task,
            user_id=current_user.id,
            lesson_id=data.lesson_id,
            message=data.message,
            response_text=response_text,
            history=history,
            lesson_context=lesson_context,
            skill_level=current_user.skill_level,
        )

    await db.commit()
    await db.refresh(ai_msg)

    return ChatResponse(
        session_id=session.id,
        message=ChatMessageResponse.model_validate(ai_msg),
        hint_level_used=data.hint_level,
        suggested_lesson=None, # Will be created in background
    )


@router.post("/stream")
async def stream_message(
    data: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    history = []
    lesson_context = None
    session_id = data.session_id

    # Ensure we have a session
    if session_id:
        result = await db.execute(
            select(ChatSession)
            .options(selectinload(ChatSession.messages))
            .where(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        )
        session = result.scalar_one_or_none()
        if not session:
            session = ChatSession(
                user_id=current_user.id,
                lesson_id=data.lesson_id,
                context="lesson" if data.lesson_id else "general",
            )
            db.add(session)
            await db.flush()
            session_id = session.id
        else:
            history = [{"role": m.role, "content": m.content} for m in session.messages[-20:]]
    else:
        session = ChatSession(
            user_id=current_user.id,
            lesson_id=data.lesson_id,
            context="lesson" if data.lesson_id else "general",
        )
        db.add(session)
        await db.flush()
        session_id = session.id

    # Save user message immediately
    user_msg = ChatMessage(session_id=session_id, role="user", content=data.message)
    db.add(user_msg)
    await db.commit()

    if data.lesson_id:
        lesson_result = await db.execute(select(Lesson).where(Lesson.id == data.lesson_id))
        lesson = lesson_result.scalar_one_or_none()
        if lesson:
            lesson_context = f"{lesson.title} ({lesson.topic})"

    async def event_stream():
        full_response = ""
        mentor = SocraticMentorAgent()
        
        try:
            async for chunk in mentor.stream_chat(
                user_message=data.message,
                conversation_history=history,
                lesson_context=lesson_context,
                code_context=data.code_context,
                hint_level=data.hint_level,
                skill_level=current_user.skill_level,
                weak_areas=current_user.weak_areas,
                suggestion_count=session.suggestion_count,
                rejected_topics=session.rejected_topics,
            ):
                full_response += chunk
                yield f"data: {json.dumps({'chunk': chunk, 'session_id': session_id})}\n\n"
        except Exception as e:
            logger.error("Error in stream_chat: %s", e)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            if full_response:
                # Use a new session for the finally block since the request one might be finished
                async with AsyncSessionLocal() as bdb:
                    try:
                        ai_msg = ChatMessage(
                            session_id=session_id,
                            role="assistant",
                            content=full_response,
                            extra={"hint_level": data.hint_level},
                        )
                        bdb.add(ai_msg)

                        # Update suggestion count if proposal made
                        if "```proposal" in full_response:
                            # We need to fetch the session again in this new session
                            ses_res = await bdb.execute(select(ChatSession).where(ChatSession.id == session_id))
                            ses = ses_res.scalar_one_or_none()
                            if ses:
                                ses.suggestion_count += 1

                        stream_topic: str | None = None
                        if data.lesson_id:
                            lesson_res = await bdb.execute(select(Lesson).where(Lesson.id == data.lesson_id))
                            _lesson = lesson_res.scalar_one_or_none()
                            if _lesson:
                                stream_topic = _lesson.topic
                        
                        bdb.add(HintUsageEvent(
                            user_id=current_user.id,
                            lesson_id=data.lesson_id,
                            session_id=session_id,
                            hint_level=data.hint_level,
                            topic=stream_topic,
                        ))
                        await bdb.commit()
                        
                        # Trigger background tasks for stream as well
                        if (data.hint_level or 0) >= 2 and stream_topic and data.lesson_id:
                            background_tasks.add_task(
                                create_remedial_lesson_task,
                                user_id=current_user.id,
                                lesson_id=data.lesson_id,
                                topic=stream_topic,
                                skill_level=current_user.skill_level,
                            )
                    except Exception as db_exc:
                        logger.error("Failed to commit streaming results: %s", db_exc)

            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/proposal/accept", response_model=SuggestedLesson)
async def accept_proposal(
    data: ProposalAcceptRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == data.session_id, ChatSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Find the reference lesson and its path
    ref_lesson_id = data.reference_lesson_id
    if ref_lesson_id == "current":
        ref_lesson_id = session.lesson_id
    
    if not ref_lesson_id:
        # Fallback to last lesson in user's first path if not in a lesson context
        path_res = await db.execute(select(LearningPath).where(LearningPath.user_id == current_user.id))
        path = path_res.scalars().first()
        if not path:
            raise HTTPException(status_code=400, detail="No learning path found")
    else:
        lesson_res = await db.execute(select(Lesson).where(Lesson.id == ref_lesson_id))
        ref_lesson = lesson_res.scalar_one_or_none()
        if not ref_lesson:
            raise HTTPException(status_code=404, detail="Reference lesson not found")
        path_res = await db.execute(select(LearningPath).where(LearningPath.id == ref_lesson.learning_path_id))
        path = path_res.scalar_one_or_none()

    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")

    # Shift existing lessons if inserting "before"
    # For now, let's just append at the end for simplicity, or find the right index
    max_idx_res = await db.execute(
        select(func.max(Lesson.order_index)).where(Lesson.learning_path_id == path.id)
    )
    max_idx = max_idx_res.scalar() or 0

    planner = PlannerAgent()
    content = await planner.generate_lesson_content(
        topic=data.topic,
        title=data.title,
        language=path.language,
        skill_level=current_user.skill_level,
        code_snippet=(path.source_code or "")[:1000],
        weak_areas=[data.topic],
    )

    new_lesson = Lesson(
        learning_path_id=path.id,
        title=data.title,
        topic=data.topic,
        description=data.description,
        order_index=max_idx + 1,
        estimated_minutes=data.estimated_minutes,
        difficulty=current_user.skill_level,
        content=content,
    )
    db.add(new_lesson)
    path.total_lessons = max_idx + 1
    await db.commit()
    await db.refresh(new_lesson)

    return SuggestedLesson(
        id=new_lesson.id,
        title=new_lesson.title,
        topic=new_lesson.topic,
        description=new_lesson.description,
        why=data.description, # Using description as why for now
        learning_path_id=path.id
    )


@router.post("/proposal/reject")
async def reject_proposal(
    data: ProposalRejectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == data.session_id, ChatSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if data.topic not in session.rejected_topics:
        # Use a list since Mapped[list[str]] is used
        current_rejected = list(session.rejected_topics)
        current_rejected.append(data.topic)
        session.rejected_topics = current_rejected
        await db.commit()
    
    return {"status": "ok"}


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
