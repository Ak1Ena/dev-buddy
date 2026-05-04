from typing import List
from pydantic import BaseModel

class Curriculum(BaseModel):
    subject: str
    level: str
    topics: List[str]

class PlannerAgent:
    """
    Agent responsible for creating a personalized learning curriculum.
    """
    def __init__(self, model_name: str = "gpt-4o"):
        self.model_name = model_name

    def generate_plan(self, subject: str, level: str) -> List[str]:
        """
        Generates a structured list of topics based on subject and level.
        In a production environment, this would be a call to an LLM with a system prompt.
        """
        # Simulation of LLM curriculum generation
        curriculums = {
            "Python": {
                "Beginner": ["Introduction to Python", "Variables & Data Types", "Control Flow", "Functions", "Basic Data Structures"],
                "Intermediate": ["Decorators & Generators", "Object-Oriented Programming", "Concurrency", "Advanced File I/O", "Testing with pytest"],
                "Advanced": ["Metaclasses", "C-Extensions", "Asyncio Deep Dive", "Performance Optimization", "Design Patterns in Python"]
            },
            "React": {
                "Beginner": ["JSX & Components", "Props & State", "Event Handling", "Lifecycle/useEffect", "Basic Hooks"],
                "Intermediate": ["Context API", "Custom Hooks", "Performance Optimization (useMemo/useCallback)", "State Management (Zustand/Redux)", "React Router"],
                "Advanced": ["Server Components", "Concurrent Mode", "Advanced Patterns (HOC/Render Props)", "Integration Testing", "Micro-Frontends"]
            }
        }
        
        # Fallback for other subjects
        default_plan = [f"Introduction to {subject}", f"Core Concepts of {subject}", f"Intermediate {subject} Patterns", f"Advanced {subject} Applications", f"Capstone Project in {subject}"]
        
        return curriculums.get(subject, {}).get(level, default_plan)
