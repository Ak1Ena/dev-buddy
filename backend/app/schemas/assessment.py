from pydantic import BaseModel, field_validator
from datetime import datetime


class AssessmentStart(BaseModel):
    code_snippet: str

    @field_validator("code_snippet")
    @classmethod
    def code_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 10:
            raise ValueError("Please paste a real code snippet (at least 10 characters)")
        if len(v) > 5000:
            raise ValueError("Code snippet too long — please paste under 5000 characters")
        return v


class CodeAnalysis(BaseModel):
    language: str
    difficulty: str
    concepts: list[str]
    summary: str
    concept_locations: dict[str, str]


class AssessmentOption(BaseModel):
    key: str
    text: str


class AssessmentQuestion(BaseModel):
    id: str
    question: str
    options: list[AssessmentOption]
    topic: str
    difficulty: str
    code_reference: str | None = None


class AssessmentStartResponse(BaseModel):
    session_id: str
    code_analysis: CodeAnalysis
    questions: list[AssessmentQuestion]


class AssessmentSubmitAnswer(BaseModel):
    session_id: str
    question_id: str
    answer_key: str


class AssessmentAnswerResult(BaseModel):
    is_correct: bool
    correct_answer: str
    explanation: str


class AssessmentResult(BaseModel):
    session_id: str
    score: int
    skill_level: str
    strong_areas: list[str]
    weak_areas: list[str]
    recommendation: str
    language: str
    concepts: list[str]
