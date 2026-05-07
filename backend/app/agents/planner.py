"""
Planner Agent — generates a personalized learning path and lesson content
grounded in the user's submitted code.
"""
import logging
from app.services.llm import get_llm_provider
from app.agents.utils import extract_json

logger = logging.getLogger(__name__)

_CONCEPT_TITLES = {
    "variables": "Variables & Assignment",
    "data_types": "Data Types",
    "operators": "Operators & Expressions",
    "conditionals": "Conditionals & Branching",
    "loops": "Loops & Iteration",
    "functions": "Functions & Parameters",
    "lists": "Lists & Sequences",
    "dictionaries": "Dictionaries & Mappings",
    "strings": "String Manipulation",
    "input_output": "Input & Output",
    "error_handling": "Error Handling",
    "recursion": "Recursion",
    "oop_basics": "Object-Oriented Basics",
    "modules": "Modules & Imports",
    "closures": "Closures",
    "higher_order_functions": "Higher-Order Functions",
    "list_comprehension": "List Comprehensions",
    "classes": "Classes",
    "async_await": "Async / Await",
    "file_io": "File I/O",
}


def _build_fallback_path(concepts: list[str], weak_areas: list[str], language: str) -> dict:
    """Build a deterministic learning path when the LLM fails."""
    # Weak areas first, then remaining concepts, padded/trimmed to 10
    ordered = list(dict.fromkeys(weak_areas + concepts))
    while len(ordered) < 10:
        for c in _CONCEPT_TITLES:
            if c not in ordered:
                ordered.append(c)
            if len(ordered) == 10:
                break
    ordered = ordered[:10]

    lessons = [
        {
            "order_index": i + 1,
            "title": _CONCEPT_TITLES.get(c, c.replace("_", " ").title()),
            "topic": c,
            "description": f"Learn about {c.replace('_', ' ')} as used in your {language} code.",
            "estimated_minutes": 20,
            "difficulty": "beginner",
        }
        for i, c in enumerate(ordered)
    ]
    return {
        "title": f"Understanding Your {language.title()} Code",
        "description": (
            "A personalized path built from the concepts in your submitted code. "
            "Each lesson focuses on one concept found in your snippet."
        ),
        "lessons": lessons,
    }

PLANNER_SYSTEM = """You are a curriculum design expert for beginner programming education.
Create a personalized learning path where every lesson is grounded in the student's actual code.

Return ONLY valid JSON — no markdown, no extra text:
{
  "title": "Understanding Your Code: [short description]",
  "description": "2-sentence description mentioning the student's code",
  "lessons": [
    {
      "order_index": 1,
      "title": "Lesson title referencing their code",
      "topic": "topic_key",
      "description": "What this lesson covers, referencing their code",
      "estimated_minutes": 20,
      "difficulty": "beginner"
    }
  ]
}

topic_key must be one of: variables, data_types, operators, conditionals, loops, functions,
lists, dictionaries, strings, input_output, error_handling, recursion, oop_basics,
modules, closures, higher_order_functions, list_comprehension, classes

Rules:
- Generate exactly 10 lessons
- Start with the concepts the student got wrong (weak_areas)
- Each lesson title should reference something from their actual code
- Build from foundational gaps to advanced concepts in their code
- estimated_minutes between 15-30"""

CONTENT_SYSTEM = """You are a programming mentor writing lesson content for absolute beginners.
Always reference the student's actual code, variable names, and line numbers.

Return ONLY valid JSON — no markdown, no extra text:
{
  "concept_hook": "One sentence using a vivid real-world metaphor. E.g. 'Think of energy_budget like a cash limit on a prepaid card — once it runs out, no more spending.'",
  "code_walkthrough": [
    {
      "code": "One line or short block from their code",
      "plain_english": "What this line DOES in plain English — no technical terms",
      "why": "Why the programmer wrote it this way — the intention behind it"
    }
  ],
  "key_concepts": ["3-5 short concept names, plain English"],
  "workshops": [
    {
      "type": "predict_output",
      "title": "What does this print?",
      "description": "Short challenge description — don't run it, just think it through",
      "code": "Short 4-8 line version of their code",
      "answer": "exact output",
      "hints": ["hint 1 pointing to a specific line", "hint 2", "hint 3"],
      "explanation": "Why that is the answer, step by step in plain English"
    }
  ],
  "summary": "One friendly sentence: what this concept does and why it matters in their specific code"
}

Rules for code_walkthrough:
- One entry per meaningful line or block
- plain_english: describe the action, not the syntax
- why: explain the programmer's intention — WHY they wrote this line"""


class PlannerAgent:
    def __init__(self):
        self.llm = get_llm_provider()

    async def generate_learning_path(
        self,
        code_snippet: str,
        language: str,
        concepts: list[str],
        skill_level: str,
        weak_areas: list[str],
        strong_areas: list[str],
        score: int,
    ) -> dict:
        prompt = f"""Create a personalized learning path for this student.

Their submitted code:
```{language}
{code_snippet}
```

Concepts in their code: {', '.join(concepts)}
Assessment score: {score}/100
Weak areas (needs focus): {', '.join(weak_areas) if weak_areas else 'general fundamentals'}
Strong areas (can go faster): {', '.join(strong_areas) if strong_areas else 'none identified'}
Skill level: {skill_level}

Generate 10 lessons that will teach them to fully understand their code."""

        for attempt, max_tok in enumerate([16000, 8000], start=1):
            try:
                raw = await self.llm.complete(
                    messages=[{"role": "user", "content": prompt}],
                    system=PLANNER_SYSTEM,
                    max_tokens=max_tok,
                )
                if not raw or not raw.strip():
                    raise ValueError("empty response")
                result = extract_json(raw)
                if isinstance(result, list):
                    result = {"title": "Your Personalized Learning Path", "description": "", "lessons": result}
                elif "lessons" not in result and isinstance(result.get("order_index"), int):
                    result = {"title": "Your Personalized Learning Path", "description": "", "lessons": [result]}
                if len(result.get("lessons", [])) >= 5:
                    return result
                raise ValueError(f"only {len(result.get('lessons', []))} lessons returned")
            except Exception as exc:
                logger.warning("Learning path LLM attempt %d failed: %s", attempt, exc)

        logger.warning("All LLM attempts failed — using deterministic fallback path")
        return _build_fallback_path(concepts, weak_areas, language)

    async def generate_lesson_content(
        self,
        topic: str,
        title: str,
        language: str,
        skill_level: str,
        code_snippet: str,
        weak_areas: list[str],
    ) -> dict:
        prompt = f"""Generate lesson content for:
Topic: {topic}
Title: {title}
Language: {language}
Student level: {skill_level}

The student's original code that motivated this lesson:
```{language}
{code_snippet}
```

Focus on the {topic} concept as it appears in their code. Reference their actual variable
names, function names, and line numbers."""

        raw = await self.llm.complete(
            messages=[{"role": "user", "content": prompt}],
            system=CONTENT_SYSTEM,
            max_tokens=3500,
        )
        if not raw or not raw.strip():
            raise ValueError("LLM returned empty response for lesson content")
        result = extract_json(raw)
        if isinstance(result, list):
            # Sibling objects — pick the one that looks like lesson content
            for item in result:
                if isinstance(item, dict) and any(k in item for k in ("concept_hook", "key_concepts", "explanation")):
                    return item
            if result and isinstance(result[0], dict):
                return result[0]
            raise ValueError("LLM returned a list with no valid lesson content object")
        return result
