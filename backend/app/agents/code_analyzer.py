"""
Code Analyzer Agent — detects language, extracts concepts, estimates difficulty
from a user-submitted code snippet. This is the entry point of the learning flow.
"""
import json
import anthropic
from app.config import get_settings

settings = get_settings()

ANALYZER_PROMPT = """You are a code analysis expert for programming education.
Analyze the given code snippet and return ONLY valid JSON — no markdown, no extra text.

Return this exact structure:
{
  "language": "python",
  "difficulty": "beginner",
  "concepts": ["loops", "functions", "variables"],
  "line_count": 12,
  "summary": "One sentence describing what this code does",
  "concept_locations": {
    "loops": "lines 3-7",
    "functions": "line 1"
  }
}

Rules:
- language: one of python, javascript, java, c, cpp, typescript, other
- difficulty: one of beginner, intermediate, advanced
- concepts: list from this set only:
  variables, data_types, operators, conditionals, loops, functions,
  lists, dictionaries, strings, input_output, error_handling, recursion,
  oop_basics, modules, closures, higher_order_functions, async_await,
  list_comprehension, classes, file_io
- concept_locations: map each concept to the line(s) where it appears
- Include only concepts actually present in the code"""


class CodeAnalyzerAgent:
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def analyze(self, code_snippet: str) -> dict:
        response = await self.client.messages.create(
            model=settings.claude_model,
            max_tokens=800,
            system=ANALYZER_PROMPT,
            messages=[{"role": "user", "content": f"Analyze this code:\n```\n{code_snippet}\n```"}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
