"""
Planner Agent — generates a personalized learning path and lesson content
grounded in the user's submitted code.
"""
import logging
import asyncio
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


def _fallback_lesson_content(topic: str, language: str, code_snippet: str = "") -> dict:
    topic_label = topic.replace("_", " ")
    sample_lines = [
        line.rstrip()
        for line in code_snippet.splitlines()
        if line.strip()
    ][:5]
    if not sample_lines:
        sample_lines = [f"// {topic_label} example"]
    walkthrough = [
        {
            "code": line,
            "plain_english": f"This line participates in the {topic_label} logic.",
            "why": "The programmer wrote it so later steps have a value or action to work with.",
        }
        for line in sample_lines[:4]
    ]
    workshop_code = "\n".join(sample_lines[:4])
    return {
        "concept_hook": f"Think of {topic_label} as a foundational block in your {language} code.",
        "code_walkthrough": walkthrough,
        "key_concepts": [topic_label],
        "workshops": [
            {
                "type": "predict_output",
                "title": f"Trace the {topic_label}",
                "description": "Read the snippet and identify which value changes first.",
                "code": workshop_code,
                "answer": "Trace the first assignment or update in order.",
                "hints": [
                    "Start at the first non-empty line.",
                    "Look for the first value that is created or changed.",
                    "Follow the code from top to bottom.",
                ],
                "explanation": f"The important move is to track how {topic_label} affects the next line of execution.",
            }
        ],
        "summary": "This concept is key to understanding the logic in your code.",
    }


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
        # For path generation, focus on the first 6000 chars of the code
        path_code = code_snippet
        if len(code_snippet) > 6000:
            path_code = code_snippet[:6000] + "\n\n# ... [code truncated for analysis] ..."

        # Detect code-level misconceptions before building the prompt (AC-GAP-001)
        try:
            misconceptions = await self.code_analyzer.detect_misconceptions(code_snippet)
        except Exception as exc:
            logger.warning("Misconception detection raised unexpectedly: %s", exc)
            misconceptions = []

        # ... (rest of the setup logic remains same)
        weak_areas = weak_areas or []
        strong_areas = strong_areas or []
        concepts = concepts or []
        gap_count = len(weak_areas)
        
        is_discovery = not weak_areas and not strong_areas and score == 0

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

        if is_discovery:
            path_type_instruction = (
                "This is a 'Discovery Path' based purely on the detected concepts. "
                "Create a logical progression from foundational to advanced concepts found in the code."
            )
            gap_info = f"Concepts found in code: {', '.join(concepts) if concepts else 'foundational concepts'}"
        else:
            path_type_instruction = (
                f"The student has {gap_count} gap{'s' if gap_count != 1 else ''} to fill. "
                "Generate exactly as many lessons as needed — one per weak area, plus any essential prerequisites. "
                "Do NOT add lessons for concepts the student already understands."
            )
            gap_info = f"Weak areas — concepts they got WRONG (each needs a lesson): {', '.join(weak_areas) if weak_areas else 'none'}"

        prompt = f"""Create a personalized learning path for this student.

Their submitted code:
```{language}
{path_code}
```

Concepts detected in their code: {', '.join(concepts) if concepts else 'general'}
Assessment score: {score}/100
{gap_info}
Strong areas — concepts they got RIGHT (skip these): {', '.join(strong_areas) if strong_areas else 'none'}
Skill level: {skill_level}
{misconception_block}

Rules for this path:
{path_type_instruction}"""

        for attempt, max_tok in enumerate([4000, 2000], start=1):
            try:
                raw = await asyncio.wait_for(
                    self.llm.complete(
                        messages=[{"role": "user", "content": prompt}],
                        system=PLANNER_SYSTEM,
                        max_tokens=max_tok,
                    ),
                    timeout=180.0,
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
                raw = await asyncio.wait_for(
                    self.llm.complete(
                        messages=[{"role": "user", "content": prompt}],
                        system=TOPIC_PLANNER_SYSTEM,
                        max_tokens=max_tok,
                    ),
                    timeout=180.0,
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
        # Focus on the relevant 5000 chars for content generation
        content_code = code_snippet
        if len(code_snippet) > 5000:
            content_code = code_snippet[:5000] + "\n\n# ... [code truncated for brevity] ..."

        prompt = f"""Generate lesson content for:
Topic: {topic}
Title: {title}
Language: {language}
Student level: {skill_level}

The student's original code that motivated this lesson:
```{language}
{content_code}
```

Focus on the {topic} concept as it appears in their code. Reference their actual variable
names, function names, and line numbers."""

        try:
            raw = await asyncio.wait_for(
                self.llm.complete(
                    messages=[{"role": "user", "content": prompt}],
                    system=CONTENT_SYSTEM,
                    max_tokens=6000,
                ),
                timeout=300.0,
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
        except asyncio.TimeoutError:
            logger.warning("Lesson content generation timed out after 300s for topic=%s", topic)
            return _fallback_lesson_content(topic, language, code_snippet)
        except ValueError:
            logger.info("Lesson content generation returned non-JSON for topic=%s; using fallback", topic)
            return _fallback_lesson_content(topic, language, code_snippet)
        except Exception as exc:
            logger.warning("Lesson content generation failed for topic=%s: %s", topic, exc)
            return _fallback_lesson_content(topic, language, code_snippet)

    async def generate_space_name(
        self,
        language: str,
        concepts: list[str],
        code_summary: str | None,
        skill_level: str | None,
    ) -> str:
        concepts_str = ", ".join(concepts[:6]) if concepts else "general programming"
        summary_str = f"\nCode summary: {code_summary}" if code_summary else ""
        level_str = f"\nSkill level: {skill_level}" if skill_level else ""

        prompt = (
            f"Generate a short, catchy learning space name (3-5 words) for a beginner learning "
            f"{language} who is studying: {concepts_str}.{summary_str}{level_str}\n\n"
            "Rules:\n"
            "- 3 to 5 words maximum\n"
            "- No quotes, no punctuation at the end\n"
            "- Descriptive and motivating\n"
            "- Reply with ONLY the name, nothing else"
        )
        try:
            raw = await asyncio.wait_for(
                self.llm.complete(
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=30,
                ),
                timeout=180.0,
            )
            name = raw.strip().strip('"').strip("'")
            return name if name else language.title()
        except Exception as exc:
            logger.warning("Space name generation failed: %s", exc)
            return language.title()
