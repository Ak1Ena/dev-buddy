from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from enum import Enum

class ProficiencyLevel(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"

class UserProfile(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    proficiency_baseline: ProficiencyLevel = ProficiencyLevel.BEGINNER
    strengths: List[str] = []
    weaknesses: List[str] = []
    interests: List[str] = []
    assessment_results: Dict[int, str] = {} # question_id: selected_option
    created_at: str
    updated_at: str

class AssessmentResponse(BaseModel):
    user_id: str
    answers: Dict[int, str] # question_id: selected_option
