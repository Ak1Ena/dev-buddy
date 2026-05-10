import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Integer, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class HintUsageEvent(Base):
    """Per-hint-level event log — satisfies AC-SGS-006 (Timestamp + Hint Level + Exercise ID)."""
    __tablename__ = "hint_usage_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    lesson_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("lessons.id"), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("chat_sessions.id"), nullable=True)
    hint_level: Mapped[int] = mapped_column(Integer, nullable=False)
    topic: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_hint_usage_events_user_id", "user_id"),
        Index("ix_hint_usage_events_lesson_id", "lesson_id"),
    )


class SkillProgression(Base):
    """Snapshot of a user's skill profile at a point in time — enables FR-05-003 retention scoring."""
    __tablename__ = "skill_progression"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    trigger: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g. "assessment_complete"
    skill_level: Mapped[str] = mapped_column(String(20), nullable=False)
    assessment_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weak_areas: Mapped[list | None] = mapped_column(JSON, nullable=True)
    strong_areas: Mapped[list | None] = mapped_column(JSON, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_skill_progression_user_id", "user_id"),
    )
