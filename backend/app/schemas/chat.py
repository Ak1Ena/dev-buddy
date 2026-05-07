from pydantic import BaseModel
from datetime import datetime


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    lesson_id: str | None = None
    code_context: str | None = None  # current code in editor
    hint_level: int = 0  # 0=question, 1=concept, 2=direction, 3=full_hint


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    metadata: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionResponse(BaseModel):
    id: str
    context: str
    messages: list[ChatMessageResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    session_id: str
    message: ChatMessageResponse
    hint_level_used: int
