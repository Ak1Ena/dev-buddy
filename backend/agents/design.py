from typing import Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

class LessonContent(BaseModel):
    topic: str = Field(description="The title of the lesson")
    content: str = Field(description="Detailed explanation of the concept")
    code_examples: list[str] = Field(description="List of code snippets illustrating the concept")
    animation_hints: str = Field(description="Suggestions for visual animations to help understanding")

class DesignAgent:
    """
    Agent responsible for crafting the actual lesson content using LLM.
    """
    def __init__(self, model_name: str = "gpt-4o"):
        self.llm = ChatOpenAI(model=model_name, temperature=0.7)
        self.parser = JsonOutputParser(pydantic_object=LessonContent)
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert technical writer and educator. "
                       "Your goal is to create high-quality, engaging, and clear programming lessons. "
                       "Include clear explanations, real-world analogies, and practical code examples. "
                       "Output ONLY a JSON object matching the schema."),
            ("user", "Create a lesson on the topic '{topic}' for a {level} level learner.")
        ])
        self.chain = self.prompt | self.llm | self.parser

    def generate_content(self, topic: str, level: str) -> Dict[str, Any]:
        try:
            return self.chain.invoke({"topic": topic, "level": level})
        except Exception as e:
            print(f"Design Error: {e}")
            return {"topic": topic, "content": "Error generating content.", "code_examples": [], "animation_hints": ""}
