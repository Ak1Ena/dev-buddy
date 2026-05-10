from pydantic import BaseModel, Field
from datetime import datetime
from app.schemas.assessment import CodeAnalysis


class LessonProgressUpdate(BaseModel):
    status: str | None = None
    hints_used: int | None = None
    workshop_score: float | None = None
    time_spent_seconds: int | None = None


class CreateSpaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class LessonResponse(BaseModel):
    id: str
    title: str
    description: str | None
    topic: str
    order_index: int
    estimated_minutes: int
    difficulty: str
    content: dict | None
    progress: dict | None = None
    space_id: str | None = None

    model_config = {"from_attributes": True}


class LearningPathResponse(BaseModel):
    id: str
    title: str
    description: str | None
    language: str
    skill_level: str
    total_lessons: int
    completed_lessons: int
    is_active: bool = True
    lessons: list[LessonResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class SpaceSummary(BaseModel):
    id: str
    name: str
    is_active: bool
    created_at: datetime
    path: LearningPathResponse | None = None

    model_config = {"from_attributes": True}


class InstantDiscoveryRequest(BaseModel):
    code_snippet: str
    language: str | None = None


class InstantDiscoveryResponse(BaseModel):
    space_id: str
    session_id: str
    analysis: CodeAnalysis
