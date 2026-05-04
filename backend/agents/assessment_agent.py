import json
from typing import Dict, List
from models.user import ProficiencyLevel

class AssessmentAgent:
    def __init__(self, questions_path: str = "data/assessment_questions.json"):
        with open(questions_path, 'r') as f:
            self.questions = json.load(f)
        
        # Mapping question categories to weights if needed
        # For now, let's just have a simple correct/incorrect or experience-based logic
        
        # Mapping of correct answers for the conceptual questions
        self.correct_answers = {
            2: "To track changes in source code and collaborate",
            3: "A way for a class to derive properties and behaviors from another class",
            4: "POST",
            5: "O(log n)",
            6: "Don't Repeat Yourself",
            7: "Designing UI layouts",
            8: "When multiple processes/threads access shared data concurrently and the outcome depends on the timing",
            9: "To improve the speed of data retrieval operations",
            10: "Compilers translate the whole program before execution, Interpreters translate line-by-line during execution"
        }

    def evaluate(self, answers: Dict[int, str]) -> Dict:
        score = 0
        total_conceptual = len(self.correct_answers)
        
        # 1. Evaluate experience (Question 1)
        experience_map = {
            "Absolute beginner (Never written code)": 0,
            "Beginner (Know basic syntax, loops, variables)": 1,
            "Intermediate (Built a few projects, understand APIs)": 2,
            "Advanced (Professional experience, system design knowledge)": 3
        }
        
        exp_answer = answers.get(1)
        exp_score = experience_map.get(exp_answer, 0)
        
        # 2. Evaluate conceptual knowledge
        correct_count = 0
        for q_id, correct_ans in self.correct_answers.items():
            if answers.get(q_id) == correct_ans:
                correct_count += 1
        
        # 3. Determine proficiency level
        # Combined logic: if they say they are advanced but fail all concepts, maybe they are intermediate.
        # If they say they are beginners but get all correct, maybe they are intermediate/advanced.
        
        final_score = (exp_score * 2) + (correct_count / total_conceptual * 10)
        
        if final_score < 4:
            level = ProficiencyLevel.BEGINNER
        elif final_score < 10:
            level = ProficiencyLevel.INTERMEDIATE
        elif final_score < 14:
            level = ProficiencyLevel.ADVANCED
        else:
            level = ProficiencyLevel.EXPERT
            
        return {
            "proficiency_baseline": level,
            "score": final_score,
            "correct_answers": correct_count,
            "total_conceptual": total_conceptual,
            "experience_score": exp_score
        }
