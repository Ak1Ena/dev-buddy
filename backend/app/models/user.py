import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500))

    # Learning profile
    skill_level: Mapped[str] = mapped_column(String(20), default="beginner")  # beginner/intermediate/advanced
    preferred_language: Mapped[str] = mapped_column(String(20), default="python")
    assessment_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    assessment_score: Mapped[int | None] = mapped_column(Integer)
    weak_areas: Mapped[list | None] = mapped_column(JSON)  # e.g. ["loops", "functions"]
    strong_areas: Mapped[list | None] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime)

    # Relationships
    assessment_sessions = relationship("AssessmentSession", back_populates="user", cascade="all, delete-orphan")
    learning_spaces = relationship("LearningSpace", back_populates="user", cascade="all, delete-orphan")
    learning_paths = relationship("LearningPath", back_populates="user", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
