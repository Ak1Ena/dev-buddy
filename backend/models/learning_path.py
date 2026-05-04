from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class Lesson(BaseModel):
    id: str
    title: str
    content: str
    order: int
    completed: bool = False
    interactive_elements: List[str] = []

class Module(BaseModel):
    id: str
    title: str
    description: str
    lessons: List[Lesson]
    order: int

class LearningPath(BaseModel):
    id: str
    user_id: str
    title: str
    description: str
    modules: List[Module]
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
