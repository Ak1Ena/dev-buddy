import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, JSON, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class AssessmentSession(Base):
    __tablename__ = "assessment_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)

    # User's submitted code — the entry point of the whole flow
    code_snippet: Mapped[str] = mapped_column(Text, nullable=False)
    detected_language: Mapped[str] = mapped_column(String(30), default="python")
    code_summary: Mapped[str | None] = mapped_column(String(500))
    extracted_concepts: Mapped[list | None] = mapped_column(JSON)  # ["loops", "functions", ...]
    concept_locations: Mapped[dict | None] = mapped_column(JSON)   # {"loops": "lines 3-7"}

    # AI-generated questions stored server-side (includes correct answers — never sent to client)
    generated_questions: Mapped[list | None] = mapped_column(JSON)

    status: Mapped[str] = mapped_column(String(20), default="in_progress")
    total_questions: Mapped[int] = mapped_column(Integer, default=10)
    correct_answers: Mapped[int] = mapped_column(Integer, default=0)
    score: Mapped[int] = mapped_column(Integer, default=0)
    skill_level_result: Mapped[str | None] = mapped_column(String(20))
    identified_topics: Mapped[dict | None] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)

    user = relationship("User", back_populates="assessment_sessions")
    answers = relationship("AssessmentAnswer", back_populates="session", cascade="all, delete-orphan")


class AssessmentAnswer(Base):
    __tablename__ = "assessment_answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("assessment_sessions.id"), nullable=False)
    question_id: Mapped[str] = mapped_column(String(100), nullable=False)
    question_text: Mapped[str] = mapped_column(String(1000), nullable=False)
    topic: Mapped[str] = mapped_column(String(100), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False)
    user_answer: Mapped[str] = mapped_column(String(500), nullable=False)
    correct_answer: Mapped[str] = mapped_column(String(500), nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    explanation: Mapped[str | None] = mapped_column(String(1000))
    answered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session = relationship("AssessmentSession", back_populates="answers")
