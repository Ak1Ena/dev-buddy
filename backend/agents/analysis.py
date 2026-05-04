from typing import List, Tuple

class AnalysisAgent:
    """
    Agent responsible for validating if the generated plan is appropriate for the user level.
    """
    def __init__(self, model_name: str = "gpt-4o"):
        self.model_name = model_name

    def validate_plan(self, subject: str, level: str, plan: List[str]) -> Tuple[bool, str]:
        """
        Validates the curriculum.
        Returns (is_approved, reason).
        """
        # Logic simulation: a plan must have at least 3 topics to be approved
        if len(plan) < 3:
            return False, "Plan is too shallow. Please provide more comprehensive topics."
        
        # Simulation of level check
        if level == "Beginner" and any("Advanced" in topic for topic in plan):
            return False, "Plan contains advanced topics unsuitable for a beginner."
            
        return True, "Plan is well-structured and matches the user's level."
