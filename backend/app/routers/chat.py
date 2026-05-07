import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.chat import ChatSession, ChatMessage
from app.models.learning import Lesson
from app.schemas.chat import ChatRequest, ChatResponse, ChatSessionResponse, ChatMessageResponse
from app.agents.socratic_mentor import SocraticMentorAgent
from app.utils.auth import get_current_user

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/send", response_model=ChatResponse)
async def send_message(
    data: ChatRequest,
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
    else:
        session = ChatSession(
            user_id=current_user.id,
            lesson_id=data.lesson_id,
            context="lesson" if data.lesson_id else "general",
        )
        db.add(session)
        await db.flush()
        session.messages = []

    # Get lesson topic for context
    lesson_context = None
    if data.lesson_id:
        lesson_result = await db.execute(select(Lesson).where(Lesson.id == data.lesson_id))
        lesson = lesson_result.scalar_one_or_none()
        if lesson:
            lesson_context = f"{lesson.title} ({lesson.topic})"

    # Build conversation history
    history = [{"role": m.role, "content": m.content} for m in session.messages]

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
    await db.commit()
    await db.refresh(ai_msg)

    return ChatResponse(
        session_id=session.id,
        message=ChatMessageResponse.model_validate(ai_msg),
        hint_level_used=data.hint_level,
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
