from pydantic import BaseModel, Field
from typing import List, Optional
import random

class Question(BaseModel):
    id: int
    text: str
    options: List[str]
    correct_answer: str

class AssessmentResult(BaseModel):
    score: int
    level: str
    recommendation: str

class AssessmentAgent:
    """
    Agent responsible for generating and scoring the 10-question assessment.
    """
    def __init__(self, subject: str):
        self.subject = subject

    def generate_questions(self) -> List[Question]:
        """
        Simulates the generation of 10 questions based on the subject.
        In a real implementation, this would call an LLM.
        """
        # Mock questions for demonstration
        questions = []
        for i in range(1, 11):
            questions.append(Question(
                id=i,
                text=f"Question {i} about {self.subject}: What is the correct concept?",
                options=[f"Option A", f"Option B", f"Option C", f"Option D"],
                correct_answer="Option A"
            ))
        return questions

    def score_assessment(self, user_answers: List[str], questions: List[Question]) -> AssessmentResult:
        """
        Scores the assessment and determines the user's level.
        """
        correct_count = 0
        for i in range(min(len(user_answers), len(questions))):
            if user_answers[i] == questions[i].correct_answer:
                correct_count += 1
        
        # Determine level based on score
        if correct_count <= 3:
            level = "Beginner"
        elif correct_count <= 7:
            level = "Intermediate"
        else:
            level = "Advanced"
            
        return AssessmentResult(
            score=correct_count,
            level=level,
            recommendation=f"Based on your score of {correct_count}/10, you are at the {level} level."
        )
