import os
from typing import List
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

class Curriculum(BaseModel):
    subject: str
    level: str
    topics: List[str]

class PlannerAgent:
    """
    Agent responsible for creating a personalized learning curriculum using LLM.
    """
    def __init__(self, model_name: str = "gpt-4o"):
        self.llm = ChatOpenAI(model=model_name, temperature=0.7)
        self.parser = JsonOutputParser(pydantic_object=Curriculum)
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a Senior Curriculum Designer for a programming tutor. "
                       "Your goal is to create a personalized, structured learning path. "
                       "The path should be logically sequenced, moving from fundamental to advanced concepts. "
                       "Output ONLY a JSON object matching the schema: {{'subject': '...', 'level': '...', 'topics': ['topic1', 'topic2', ...]}}"),
            ("user", "Create a learning path for {subject} at the {level} level. Provide 5-8 essential topics.")
        ])
        self.chain = self.prompt | self.llm | self.parser

    def generate_plan(self, subject: str, level: str) -> List[str]:
        try:
            response = self.chain.invoke({"subject": subject, "level": level})
            return response["topics"]
        except Exception as e:
            print(f"Planner Error: {e}")
            return [f"Introduction to {subject}", "Core Concepts", "Advanced Applications"]
