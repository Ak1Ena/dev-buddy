"""
Code Analyzer Agent — detects language, extracts concepts, estimates difficulty
from a user-submitted code snippet.
"""
import json
from app.services.llm import get_llm_provider

SYSTEM = """You are a code analysis expert for programming education.
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
        self.llm = get_llm_provider()

    async def analyze(self, code_snippet: str) -> dict:
        raw = await self.llm.complete(
            messages=[{"role": "user", "content": f"Analyze this code:\n```\n{code_snippet}\n```"}],
            system=SYSTEM,
            max_tokens=800,
        )
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
