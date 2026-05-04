from typing import Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

class LessonContent(BaseModel):
    topic: str = Field(description="The title of the lesson")
    content: str = Field(description="Detailed explanation of the concept")
    code_examples: list[str] = Field(description="List of code snippets illustrating the concept")
    animation_html: str = Field(description="A standalone, responsive HTML/CSS/JS snippet that visually animates the core concept. Use a dark-themed, minimalist, and professional aesthetic.")

class DesignAgent:
    """
    Agent responsible for crafting the actual lesson content, including interactive HTML animations.
    """
    def __init__(self, model_name: str = "gpt-4o"):
        self.llm = ChatOpenAI(model=model_name, temperature=0.7)
        self.parser = JsonOutputParser(pydantic_object=LessonContent)
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert technical writer and a creative frontend developer. "
                       "Your goal is to create high-quality, engaging programming lessons. "
                       "For every lesson, you MUST provide a 'animation_html' field containing a "
                       "standalone HTML/CSS/JS snippet that visually demonstrates the concept. "
                       "The animation should be: \n"
                       "1. Responsive and standalone (all CSS/JS inline).\n"
                       "2. Dark-themed (Background: #020617, Accents: #22d3ee, #a78bfa).\n"
                       "3. Interactive or auto-animating to explain the technical logic.\n"
                       "4. Professional and minimalist.\n"
                       "Output ONLY a JSON object matching the schema."),
            ("user", "Create a lesson on the topic '{topic}' for a {level} level learner. "
                     "Make sure the animation_html is a high-quality visual explanation of the topic.")
        ])
        self.chain = self.prompt | self.llm | self.parser

    def generate_content(self, topic: str, level: str) -> Dict[str, Any]:
        try:
            return self.chain.invoke({"topic": topic, "level": level})
        except Exception as e:
            print(f"Design Error: {e}")
            return {
                "topic": topic, 
                "content": "Error generating content.", 
                "code_examples": [], 
                "animation_html": "<div>Animation unavailable</div>"
            }
