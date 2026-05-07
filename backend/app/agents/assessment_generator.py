"""
Assessment Generator Agent — creates 10 targeted questions from the user's code.
"""
from app.services.llm import get_llm_provider
from app.agents.utils import extract_json

SYSTEM = """You are a programming assessment designer for beginners.
Given a code snippet and its extracted concepts, generate exactly 10 multiple-choice questions.

Questions must:
1. Reference specific parts of the provided code (e.g., "In line 3 of your code, what does `range(len(arr))` do?")
2. Test understanding — not memorization
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

Generate exactly 10 questions covering the concepts in the code."""



class AssessmentGeneratorAgent:
    def __init__(self):
        self.llm = get_llm_provider()

    async def generate_questions(self, code_snippet: str, concepts: list[str], language: str) -> list[dict]:
        prompt = f"""Generate 10 assessment questions for this {language} code snippet.

The code:
```{language}
{code_snippet}
```

Concepts present: {', '.join(concepts)}

Make questions that specifically reference this code — use line numbers, variable names,
and function names from the actual code."""

        raw = await self.llm.complete(
            messages=[{"role": "user", "content": prompt}],
            system=SYSTEM,
            max_tokens=16000,
        )
        if not raw or not raw.strip():
            raise ValueError("LLM returned an empty response for question generation")
        data = extract_json(raw)
        # Model may return a bare list of question objects or {"questions": [...]}
        if isinstance(data, list):
            return data
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
        recommendation = "Strong grasp of most concepts! Lessons will focus on the few gaps and go deeper."
    elif score >= 50:
        skill_level = "beginner"
        recommendation = "Good foundation! Lessons will reinforce the weak spots in your code understanding."
    else:
        skill_level = "beginner"
        recommendation = "Great starting point — lessons will explain this code from the ground up, step by step."

    return {
        "score": score,
        "skill_level": skill_level,
        "strong_areas": strong_areas,
        "weak_areas": weak_areas,
        "recommendation": recommendation,
    }
