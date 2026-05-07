"""
Code Analyzer Agent — detects language, extracts concepts, estimates difficulty
from a user-submitted code snippet.
"""
import json
import logging
from app.services.llm import get_llm_provider

logger = logging.getLogger(__name__)

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


def _extract_json(text: str) -> dict:
    """Pull the first {...} block out of a possibly-noisy LLM response."""
    text = text.strip()
    # strip ```json ... ``` fences
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{"):
                text = part
                break
    # find outermost { ... }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Could not parse JSON from LLM response: {exc}\nRaw: {text[:300]}") from exc


class CodeAnalyzerAgent:
    def __init__(self):
        self.llm = get_llm_provider()

    async def analyze(self, code_snippet: str) -> dict:
        raw = await self.llm.complete(
            messages=[{"role": "user", "content": f"Analyze this code:\n```\n{code_snippet}\n```"}],
            system=SYSTEM,
            max_tokens=8000,
        )
        logger.debug("CodeAnalyzer raw LLM response: %r", raw[:500] if raw else "<empty>")
        if not raw or not raw.strip():
            raise ValueError("LLM returned an empty response for code analysis")
        return _extract_json(raw)
