import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, JSON, Boolean, Text, Float, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class LearningPath(Base):
    __tablename__ = "learning_paths"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(20), default="python")
    skill_level: Mapped[str] = mapped_column(String(20), default="beginner")

    # The original code that generated this path — used to ground all lesson content
    source_code: Mapped[str | None] = mapped_column(Text)
    extracted_concepts: Mapped[list | None] = mapped_column(JSON)

    total_lessons: Mapped[int] = mapped_column(Integer, default=0)
    completed_lessons: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="learning_paths")
    lessons = relationship("Lesson", back_populates="learning_path", cascade="all, delete-orphan", order_by="Lesson.order_index")


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    learning_path_id: Mapped[str] = mapped_column(String(36), ForeignKey("learning_paths.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    topic: Mapped[str] = mapped_column(String(100), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=15)
    difficulty: Mapped[str] = mapped_column(String(20), default="beginner")
    content: Mapped[dict | None] = mapped_column(JSON)
    is_remedial: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    learning_path = relationship("LearningPath", back_populates="lessons")
    progress = relationship("LessonProgress", back_populates="lesson", uselist=False)

    __table_args__ = (
        Index("ix_lessons_learning_path_id", "learning_path_id"),
    )


class LessonProgress(Base):
    __tablename__ = "lesson_progress"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    lesson_id: Mapped[str] = mapped_column(String(36), ForeignKey("lessons.id"), nullable=False, unique=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="not_started")
    hints_used: Mapped[int] = mapped_column(Integer, default=0)
    workshop_score: Mapped[float | None] = mapped_column(Float)
    time_spent_seconds: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)

    lesson = relationship("Lesson", back_populates="progress")
