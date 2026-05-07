from pydantic import BaseModel
from datetime import datetime


class LessonProgressUpdate(BaseModel):
    status: str | None = None
    hints_used: int | None = None
    workshop_score: float | None = None
    time_spent_seconds: int | None = None


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

    model_config = {"from_attributes": True}


class LearningPathResponse(BaseModel):
    id: str
    title: str
    description: str | None
    language: str
    skill_level: str
    total_lessons: int
    completed_lessons: int
    lessons: list[LessonResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}
