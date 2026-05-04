from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class UserProfileSchema(BaseModel):
    user_id: str
    subject: str
    level: str # Beginner, Intermediate, Advanced
    last_assessment_date: datetime
    knowledge_gaps: List[str] = []

class LearningPathSchema(BaseModel):
    path_id: str
    user_id: str
    subject: str
    modules: List[ModuleSchema]
    current_module_index: int = 0

class ModuleSchema(BaseModel):
    module_id: str
    title: str
    content: str
    is_completed: bool = False
    is_deep_dive: bool = False # True if this was injected by the Curiosity Loop
