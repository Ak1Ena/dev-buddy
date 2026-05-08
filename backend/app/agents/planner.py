"""
Planner Agent — generates a personalized learning path and lesson content
grounded in the user's submitted code.
"""
import logging
from app.services.llm import get_llm_provider
from app.agents.utils import extract_json
from app.agents.code_analyzer import CodeAnalyzerAgent

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
    """Build a deterministic learning path when the LLM fails.
    Only covers what the student actually needs — weak areas first, then
    any code concepts not already mastered.
    """
    # Weak areas drive the path; add code concepts not yet covered, skip padding
    ordered = list(dict.fromkeys(weak_areas + concepts))
    ordered = ordered[:8]  # hard cap, but no artificial minimum
    if not ordered:
        ordered = list(_CONCEPT_TITLES.keys())[:3]

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
            "A personalized path targeting only the gaps in your understanding. "
            "Each lesson focuses on one concept found in your submitted code."
        ),
        "lessons": lessons,
    }

PLANNER_SYSTEM = """You are a curriculum design expert for beginner programming education.
Create a personalized learning path targeting only the student's actual gaps.

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
- Generate ONLY the lessons the student actually needs — no padding
- Each weak_area gets its own lesson (these are concepts the student got wrong on the assessment)
- Add a lesson for a prerequisite concept only if it is essential to understand a weak area
- Skip strong_areas entirely — the student already understands those
- Minimum 1 lesson, maximum 8 lessons; let the gap analysis dictate the count
- Order: foundational gaps first, then build toward the advanced concepts in their code
- Each lesson title should reference something specific from their actual code
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


TOPIC_PLANNER_SYSTEM = """You are a curriculum design expert for beginner programming education.
Create a structured learning path for a specific programming topic or goal.

Return ONLY valid JSON — no markdown, no extra text:
{
  "title": "Learning [Topic] in [Language]",
  "description": "2-sentence description of what will be covered and learned",
  "lessons": [
    {
      "order_index": 1,
      "title": "Lesson title",
      "topic": "topic_key",
      "description": "What this lesson covers and why it matters",
      "estimated_minutes": 20,
      "difficulty": "beginner"
    }
  ]
}

topic_key must be one of: variables, data_types, operators, conditionals, loops, functions,
lists, dictionaries, strings, input_output, error_handling, recursion, oop_basics,
modules, closures, higher_order_functions, list_comprehension, classes, async_await, file_io

Rules:
- Generate 3-8 lessons that form a logical progression
- Start from the student's current level and build incrementally
- difficulty starts at the student's level then can advance within the path
- estimated_minutes between 15-30
- Each lesson title should be concrete, not generic"""


class PlannerAgent:
    def __init__(self):
        self.llm = get_llm_provider()
        self.code_analyzer = CodeAnalyzerAgent()

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
        # Detect code-level misconceptions before building the prompt (AC-GAP-001)
        try:
            misconceptions = await self.code_analyzer.detect_misconceptions(code_snippet)
        except Exception as exc:
            logger.warning("Misconception detection raised unexpectedly: %s", exc)
            misconceptions = []

        gap_count = len(weak_areas)

        if misconceptions:
            misconception_lines = "\n".join(
                f"  - {m['misconception_type']} ({m['error_category']}, "
                f"{m.get('confidence_score', 0):.0%} confidence): "
                f"{m.get('description', '')} [{m.get('location', 'unknown')}]"
                for m in misconceptions
            )
            misconception_block = (
                f"\nMisconceptions detected directly in their code:\n{misconception_lines}\n"
                "Each lesson that covers a topic related to a listed misconception must "
                "explicitly address that specific error pattern."
            )
        else:
            misconception_block = ""

        prompt = f"""Create a personalized learning path for this student.

Their submitted code:
```{language}
{code_snippet}
```

Concepts detected in their code: {', '.join(concepts) if concepts else 'general'}
Assessment score: {score}/100
Weak areas — concepts they got WRONG (each needs a lesson): {', '.join(weak_areas) if weak_areas else 'none'}
Strong areas — concepts they got RIGHT (skip these): {', '.join(strong_areas) if strong_areas else 'none'}
Skill level: {skill_level}
Number of weak areas: {gap_count}{misconception_block}

The student has {gap_count} gap{'s' if gap_count != 1 else ''} to fill.
Generate exactly as many lessons as needed — one per weak area, plus any essential prerequisites.
Do NOT add lessons for concepts the student already understands."""

        for attempt, max_tok in enumerate([4000, 2000], start=1):
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
                if len(result.get("lessons", [])) >= 1:
                    return result
                raise ValueError("no lessons returned")
            except Exception as exc:
                logger.warning("Learning path LLM attempt %d failed: %s", attempt, exc)

        logger.warning("All LLM attempts failed — using deterministic fallback path")
        return _build_fallback_path(concepts, weak_areas, language)

    async def generate_topic_path(
        self,
        topic: str,
        language: str,
        skill_level: str,
    ) -> dict:
        prompt = f"""Create a learning path for:
Topic / Goal: {topic}
Programming Language: {language}
Student level: {skill_level}

Design a clear progression of lessons that teaches this topic starting from the student's current level."""

        for attempt, max_tok in enumerate([3000, 1500], start=1):
            try:
                raw = await self.llm.complete(
                    messages=[{"role": "user", "content": prompt}],
                    system=TOPIC_PLANNER_SYSTEM,
                    max_tokens=max_tok,
                )
                if not raw or not raw.strip():
                    raise ValueError("empty response")
                result = extract_json(raw)
                if isinstance(result, list):
                    result = {"title": f"Learning {topic}", "description": "", "lessons": result}
                if len(result.get("lessons", [])) >= 1:
                    return result
                raise ValueError("no lessons returned")
            except Exception as exc:
                logger.warning("Topic path LLM attempt %d failed: %s", attempt, exc)

        # Deterministic fallback
        fallback_topics = ["variables", "data_types", "conditionals", "loops", "functions"]
        return {
            "title": f"Learning {topic} in {language.title()}",
            "description": f"A structured path to learn {topic} in {language}.",
            "lessons": [
                {
                    "order_index": i + 1,
                    "title": _CONCEPT_TITLES.get(t, t.replace("_", " ").title()),
                    "topic": t,
                    "description": f"Learn about {t.replace('_', ' ')} as part of {topic}.",
                    "estimated_minutes": 20,
                    "difficulty": skill_level,
                }
                for i, t in enumerate(fallback_topics[:5])
            ],
        }

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
