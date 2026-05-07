"""
Planner Agent — generates a personalized learning path based on the user's
submitted code + assessment results. All lessons are grounded in the user's code.
"""
import json
import anthropic
from app.config import get_settings

settings = get_settings()

PLANNER_PROMPT = """You are a curriculum design expert for beginner programming education.
Given a student's code snippet and assessment results, create a personalized learning path
where every lesson is grounded in their actual code.

Return ONLY valid JSON — no markdown, no explanation outside the JSON:
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
- Start with the concepts the student got wrong in the assessment (weak_areas)
- Each lesson title should reference something from their actual code
- Build from foundational gaps to the more advanced concepts in their code
- estimated_minutes between 15-30"""


CONTENT_PROMPT = """You are a programming education content designer.
Generate lesson content that always refers back to the student's original code.
Return ONLY valid JSON — no markdown, no extra text:
{
  "explanation": "Clear explanation referencing the student's code (2-3 paragraphs)",
  "key_concepts": ["concept 1", "concept 2", "concept 3"],
  "code_examples": [
    {
      "title": "From your code",
      "code": "the relevant snippet from their code",
      "explanation": "Line-by-line explanation of what this does",
      "language": "python"
    },
    {
      "title": "Similar example",
      "code": "a variation to reinforce understanding",
      "explanation": "How this compares to their code",
      "language": "python"
    }
  ],
  "visualizations": [
    {
      "type": "variable_trace",
      "title": "Visualization title",
      "code": "code to visualize (from their snippet if applicable)",
      "steps": [
        {"step": 1, "description": "what happens", "state": {"var_name": "value"}}
      ]
    }
  ],
  "workshops": [
    {
      "type": "predict_output",
      "title": "Workshop title",
      "description": "What to do — reference their code where possible",
      "code": "code for the exercise (modified version of their code)",
      "answer": "correct answer",
      "hints": ["hint 1", "hint 2", "hint 3"],
      "explanation": "Why this is the answer"
    },
    {
      "type": "fill_in_blank",
      "title": "Workshop title",
      "description": "Complete the missing part",
      "code": "code with ___ for blank",
      "answer": "the missing code",
      "hints": ["hint 1", "hint 2", "hint 3"],
      "explanation": "Why this fills the blank"
    }
  ],
  "summary": "One-sentence summary tying back to their original code"
}"""


class PlannerAgent:
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

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

Generate 10 lessons that will teach them to fully understand their code above.
Lessons should reference specific parts of their code."""

        response = await self.client.messages.create(
            model=settings.claude_model,
            max_tokens=2000,
            system=PLANNER_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)

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

Focus specifically on the {topic} concept as it appears in their code above.
Reference their actual variable names, function names, and line numbers where relevant."""

        response = await self.client.messages.create(
            model=settings.claude_model,
            max_tokens=4000,
            system=CONTENT_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
