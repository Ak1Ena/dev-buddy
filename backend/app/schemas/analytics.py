from datetime import datetime
from pydantic import BaseModel


class HintUsageEventOut(BaseModel):
    id: str
    lesson_id: str | None
    session_id: str | None
    hint_level: int
    topic: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SkillProgressionOut(BaseModel):
    id: str
    trigger: str
    skill_level: str
    assessment_score: int | None
    weak_areas: list[str] | None
    strong_areas: list[str] | None
    recorded_at: datetime

    model_config = {"from_attributes": True}


class AnalyticsDashboard(BaseModel):
    """Aggregated learning analytics for the current user (FR-05-001 through FR-05-005)."""

    # FR-05-001: average hints used per completed lesson
    hint_dependency_rate: float

    # FR-05-002: average time in seconds to complete a lesson
    avg_completion_time_seconds: float

    # FR-05-003: fraction of originally-weak areas now resolved (0.0–1.0)
    concept_retention_score: float

    # FR-05-004: fraction of lessons where workshop was attempted
    workshop_completion_rate: float

    # FR-05-005: hint events per topic, sorted descending — most-struggled topics first
    misconception_frequency: dict[str, int]

    # AC-SGS-006: breakdown of hint events by level
    hints_by_level: dict[str, int]

    # Supporting counters
    total_hint_events: int
    lessons_completed: int
    lessons_in_progress: int
    lessons_total: int

    # Historical skill snapshots (oldest first)
    skill_progression: list[SkillProgressionOut]
