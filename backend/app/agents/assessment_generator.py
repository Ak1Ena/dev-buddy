"""
Assessment Generator Agent — creates 10 targeted multiple-choice questions
from the user's actual code snippet. Questions reference specific lines and
patterns in their code so answers are grounded in something they care about.
"""
import json
import anthropic
from app.config import get_settings

settings = get_settings()

GENERATOR_PROMPT = """You are a programming assessment designer for beginners.
Given a code snippet and its extracted concepts, generate exactly 10 multiple-choice questions.

Questions must:
1. Reference specific parts of the provided code (e.g., "In line 3 of your code, what does `range(len(arr))` do?")
2. Test understanding of the concepts in that code — not memorization
3. Have exactly 4 options (A/B/C/D) with one correct answer
4. Progress from simpler to more complex

Return ONLY valid JSON — no markdown, no extra text:
{
  "questions": [
    {
      "id": "q1",
      "question": "Question text referencing the code",
      "options": [
        {"key": "A", "text": "option text"},
        {"key": "B", "text": "option text"},
        {"key": "C", "text": "option text"},
        {"key": "D", "text": "option text"}
      ],
      "correct": "A",
      "topic": "loops",
      "difficulty": "beginner",
      "code_reference": "line 3",
      "explanation": "Why this answer is correct"
    }
  ]
}

topic must be one of: variables, data_types, operators, conditionals, loops, functions,
lists, dictionaries, strings, input_output, error_handling, recursion, oop_basics,
modules, closures, higher_order_functions, list_comprehension, classes

Generate exactly 10 questions covering all the concepts found in the code."""


class AssessmentGeneratorAgent:
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def generate_questions(self, code_snippet: str, concepts: list[str], language: str) -> list[dict]:
        prompt = f"""Generate 10 assessment questions for this {language} code snippet.

The code:
```{language}
{code_snippet}
```

Concepts present in this code: {', '.join(concepts)}

Make questions that specifically reference this code — use line numbers, variable names,
and function names from the actual code. Test if the student understands what each part does."""

        response = await self.client.messages.create(
            model=settings.claude_model,
            max_tokens=3000,
            system=GENERATOR_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        return data["questions"]


def check_answer(questions: list[dict], question_id: str, answer_key: str) -> dict:
    for q in questions:
        if q["id"] == question_id:
            return {
                "is_correct": q["correct"] == answer_key,
                "correct_answer": q["correct"],
                "question_text": q["question"],
                "topic": q["topic"],
                "difficulty": q["difficulty"],
                "explanation": q.get("explanation", ""),
            }
    raise ValueError(f"Question {question_id} not found")


def calculate_score(answers: list[dict]) -> dict:
    total = len(answers)
    if total == 0:
        return {"score": 0, "skill_level": "beginner", "strong_areas": [], "weak_areas": [], "recommendation": ""}

    correct = sum(1 for a in answers if a["is_correct"])
    score = int((correct / total) * 100)

    topic_results: dict[str, dict] = {}
    for a in answers:
        t = a["topic"]
        if t not in topic_results:
            topic_results[t] = {"correct": 0, "total": 0}
        topic_results[t]["total"] += 1
        if a["is_correct"]:
            topic_results[t]["correct"] += 1

    strong_areas = [t for t, r in topic_results.items() if r["correct"] / r["total"] >= 0.7]
    weak_areas = [t for t, r in topic_results.items() if r["correct"] / r["total"] < 0.5]

    if score >= 80:
        skill_level = "intermediate"
        recommendation = "Strong grasp of most concepts! Your lessons will focus on the few gaps and go deeper."
    elif score >= 50:
        skill_level = "beginner"
        recommendation = "Good foundation! Your lessons will reinforce the weak spots in your code understanding."
    else:
        skill_level = "beginner"
        recommendation = "Great starting point — your lessons will explain this code from the ground up, step by step."

    return {
        "score": score,
        "skill_level": skill_level,
        "strong_areas": strong_areas,
        "weak_areas": weak_areas,
        "recommendation": recommendation,
    }
