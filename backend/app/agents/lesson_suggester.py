"""
Lesson Suggester Agent — triggered when a student reaches hint level 3.
Analyses the conversation to identify the concept gap, then produces a
mini-lesson specification for the Planner to flesh out.
"""
import logging
from app.services.llm import get_llm_provider
from app.agents.utils import extract_json

logger = logging.getLogger(__name__)

SUGGESTER_SYSTEM = """You are a programming education specialist.
Given a tutoring conversation where a student reached hint level 3 (needed a
full worked example), identify the ONE core concept they are struggling with
and design a focused remedial mini-lesson.

Return ONLY valid JSON — no markdown, no extra text:
{
  "should_create": true,
  "topic": "loops",
  "title": "Following a loop step by step",
  "description": "A short lesson to walk through what happens each iteration, using your own code",
  "why": "You needed the full worked example for the loop step — this lesson will build that mental model",
  "difficulty": "beginner",
  "estimated_minutes": 15
}

topic must be one of: variables, data_types, operators, conditionals, loops,
functions, lists, dictionaries, strings, input_output, error_handling,
recursion, oop_basics, modules, closures, higher_order_functions,
list_comprehension, classes

Rules:
- Set "should_create": false if the conversation doesn't show a clear concept gap.
- Keep title and description SHORT and student-friendly.
- "why" is shown to the student — make it personal and encouraging, not clinical."""


class LessonSuggesterAgent:
    def __init__(self):
        self.llm = get_llm_provider()

    async def suggest(
        self,
        conversation: list[dict],
        lesson_context: str | None = None,
    ) -> dict | None:
        """Return a lesson spec dict, or None if no lesson should be created."""
        ctx = f"\nLesson context: {lesson_context}" if lesson_context else ""
        history_text = "\n".join(
            f"{m['role'].upper()}: {m['content'][:300]}" for m in conversation[-10:]
        )
        prompt = f"""Review this tutoring conversation where the student needed a full worked example (hint level 3).{ctx}

Conversation:
{history_text}

Should a remedial mini-lesson be created? If yes, design it."""

        try:
            raw = await self.llm.complete(
                messages=[{"role": "user", "content": prompt}],
                system=SUGGESTER_SYSTEM,
                max_tokens=600,
            )
            if not raw or not raw.strip():
                return None
            result = extract_json(raw)
            if isinstance(result, dict) and result.get("should_create"):
                return result
            return None
        except Exception as exc:
            logger.warning("LessonSuggester failed: %s", exc)
            return None
