from typing import List, Tuple
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

class AnalysisAgent:
    """
    Agent responsible for validating if the generated plan is appropriate for the user level.
    """
    def __init__(self, model_name: str = "gpt-4o"):
        self.llm = ChatOpenAI(model=model_name, temperature=0)
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a Quality Assurance Expert for educational content. "
                       "Evaluate the provided curriculum for a specific level. "
                       "Check if the topics are too easy, too hard, or logically sequenced. "
                       "Respond with 'APPROVED' if it's good, or 'REJECTED: [reason]' if it needs changes."),
            ("user", "Subject: {subject}\nLevel: {level}\nPlan: {plan}")
        ])
        self.chain = self.prompt | self.llm

    def validate_plan(self, subject: str, level: str, plan: List[str]) -> Tuple[bool, str]:
        try:
            response = self.chain.invoke({"subject": subject, "level": level, "plan": plan}).content
            if "APPROVED" in response.upper():
                return True, "Plan approved."
            return False, response
        except Exception as e:
            print(f"Analysis Error: {e}")
            return True, "Proceeding due to analysis error."
