"""
Assessment Generator Agent — creates 10 targeted questions from the user's code.
"""
import logging
import re
import asyncio
from app.services.llm import get_llm_provider
from app.agents.utils import extract_json

logger = logging.getLogger(__name__)

SYSTEM = """You are a programming assessment designer for beginners.
Given a code snippet and its extracted concepts, generate exactly {count} multiple-choice questions focusing on the LOGIC and BEHAVIOR of the code.

Questions MUST:
1. Reference specific parts of the provided code (e.g., "What value does `calculate_sum` return if the input is `[1, 2, 3]`?")
2. Focus on data flow, variable changes, and function execution logic.
3. Test understanding of what the code DOES, not just how it is WRITTEN.
4. Avoid generic language syntax questions (e.g., do NOT ask "How do you define a function?" or "What does 'if' mean?").
5. Have exactly 4 options (A/B/C/D) with one correct answer.
6. Progress from simpler to more complex logical paths.

Return ONLY valid JSON — no markdown, no extra text:
{{
  "questions": [
    {{
      "id": "q1",
      "question": "Question text referencing specific logic in the code",
      "options": [
        {{"key": "A", "text": "option text"}},
        {{"key": "B", "text": "option text"}},
        {{"key": "C", "text": "option text"}},
        {{"key": "D", "text": "option text"}}
      ],
      "correct": "A",
      "topic": "functions",
      "difficulty": "beginner",
      "code_reference": "line 3",
      "explanation": "Why this answer is correct based on the code's logic"
    }}
  ]
}}

topic must be one of: variables, data_types, operators, conditionals, loops, functions,
lists, dictionaries, strings, input_output, error_handling, recursion, oop_basics,
modules, closures, higher_order_functions, list_comprehension, classes

Generate exactly {count} questions covering the logic of the code."""



_CONCEPT_QUESTIONS: dict[str, list[dict]] = {
    "loops": [
        {
            "question": "Looking at the loop in your code, what determines how many times it will run?",
            "options": [
                {"key": "A", "text": "The condition or sequence provided in the loop statement"},
                {"key": "B", "text": "The number of variables in the function"},
                {"key": "C", "text": "The name of the function"},
                {"key": "D", "text": "The type of programming language used"},
            ],
            "correct": "A",
            "topic": "loops",
            "difficulty": "beginner",
            "code_reference": "loop statement",
            "explanation": "The loop's duration is controlled by its condition (in a while loop) or the length of the sequence it iterates over (in a for loop).",
        },
        {
            "question": "What happens to the data inside the loop during each iteration?",
            "options": [
                {"key": "A", "text": "It is processed or modified according to the instructions inside the loop body"},
                {"key": "B", "text": "It is automatically deleted after the first pass"},
                {"key": "C", "text": "It is sent to a different function immediately"},
                {"key": "D", "text": "It remains exactly the same and cannot be changed"},
            ],
            "correct": "A",
            "topic": "loops",
            "difficulty": "beginner",
            "code_reference": "loop body",
            "explanation": "A loop is used to repeat operations on data, typically updating variables or performing calculations in each step.",
        },
    ],
    "functions": [
        {
            "question": "Based on the function in your code, what is the purpose of its parameters?",
            "options": [
                {"key": "A", "text": "They act as placeholders for the data the function needs to work with"},
                {"key": "B", "text": "They are used to name the entire file"},
                {"key": "C", "text": "They determine the speed of the program"},
                {"key": "D", "text": "They are only for documentation and don't affect logic"},
            ],
            "correct": "A",
            "topic": "functions",
            "difficulty": "beginner",
            "code_reference": "function parameters",
            "explanation": "Parameters allow you to pass specific values into a function so it can perform logic on that data.",
        },
        {
            "question": "In the context of your function, what does the `return` statement accomplish?",
            "options": [
                {"key": "A", "text": "It provides the final result of the function's logic back to the caller"},
                {"key": "B", "text": "It restarts the function from the beginning"},
                {"key": "C", "text": "It prints a message to the screen without changing any data"},
                {"key": "D", "text": "It stops the entire program execution"},
            ],
            "correct": "A",
            "topic": "functions",
            "difficulty": "beginner",
            "code_reference": "return statement",
            "explanation": "The `return` statement exits the function and 'gives back' the calculated value.",
        },
    ],
    "conditionals": [
        {
            "question": "How does the `if` statement in your code affect the execution flow?",
            "options": [
                {"key": "A", "text": "It chooses whether to run a specific block of code based on a condition"},
                {"key": "B", "text": "It forces the code to run multiple times"},
                {"key": "C", "text": "It defines a new variable name"},
                {"key": "D", "text": "It imports an external library"},
            ],
            "correct": "A",
            "topic": "conditionals",
            "difficulty": "beginner",
            "code_reference": "if statement",
            "explanation": "Conditionals allow the program to make decisions and execute different logic paths depending on whether a condition is True or False.",
        },
    ],
    "variables": [
        {
            "question": "What happens to a variable's value when a new value is assigned to it in your code?",
            "options": [
                {"key": "A", "text": "The old value is replaced by the new one"},
                {"key": "B", "text": "The old value and new value are added together automatically"},
                {"key": "C", "text": "The program crashes immediately"},
                {"key": "D", "text": "Nothing, variables cannot be changed once created"},
            ],
            "correct": "A",
            "topic": "variables",
            "difficulty": "beginner",
            "code_reference": "variable assignment",
            "explanation": "Assignment (`=`) updates the data stored in a variable, replacing whatever was there before.",
        },
    ],
}

_GENERIC_QUESTIONS = [
    {
        "question": "How does the computer know which lines of code belong inside a function or loop in this snippet?",
        "options": [
            {"key": "A", "text": "By looking at the indentation (spacing) of the lines"},
            {"key": "B", "text": "By the color of the text"},
            {"key": "C", "text": "By the number of variables used"},
            {"key": "D", "text": "It runs every line regardless of where they are"},
        ],
        "correct": "A",
        "topic": "variables",
        "difficulty": "beginner",
        "code_reference": "indentation",
        "explanation": "In many languages like Python, indentation defines the structure and scope of code blocks.",
    },
    {
        "question": "What is the primary goal of the logic provided in this code snippet?",
        "options": [
            {"key": "A", "text": "To process input data and produce a specific result or behavior"},
            {"key": "B", "text": "To fill up memory on the computer"},
            {"key": "C", "text": "To create a user interface with buttons"},
            {"key": "D", "text": "To connect to the internet"},
        ],
        "correct": "A",
        "topic": "input_output",
        "difficulty": "beginner",
        "code_reference": "logic flow",
        "explanation": "Programming is essentially about defining a series of steps to transform inputs into outputs.",
    },
]


def _generate_fallback_questions(code_snippet: str, concepts: list[str], language: str, question_count: int = 10) -> list[dict]:
    questions: list[dict] = []
    used_topics: set[str] = set()

    for concept in concepts:
        if concept in _CONCEPT_QUESTIONS:
            for q in _CONCEPT_QUESTIONS[concept]:
                if q["topic"] not in used_topics:
                    questions.append(q)
                    used_topics.add(q["topic"])
                if len(questions) >= question_count:
                    break
        if len(questions) >= question_count:
            break

    for q in _GENERIC_QUESTIONS:
        if len(questions) >= question_count:
            break
        if q["topic"] not in used_topics:
            questions.append(q)
            used_topics.add(q["topic"])

    # Pad if still short
    i = 0
    while len(questions) < question_count:
        questions.append(_GENERIC_QUESTIONS[i % len(_GENERIC_QUESTIONS)])
        i += 1

    # Assign stable IDs
    return [{"id": f"q{i+1}", **q} for i, q in enumerate(questions[:question_count])]


class AssessmentGeneratorAgent:
    def __init__(self):
        self.llm = get_llm_provider()

    async def generate_questions(self, code_snippet: str, concepts: list[str], language: str, question_count: int = 10) -> list[dict]:
        prompt = f"""Generate {question_count} assessment questions focusing on the logic and behavior of this {language} code.

The code:
```{language}
{code_snippet}
```

Concepts present: {', '.join(concepts)}

DO NOT ask general questions about {language} syntax. 
INSTEAD, ask about:
1. What the code/function returns for specific example inputs.
2. How a specific variable changes its value during execution.
3. The specific logical path taken when a certain condition is met.
4. The purpose of specific lines within the context of THIS code's goal.

Use the actual function names and variable names from the code. Ensure the questions progress from simple data checks to complex logical flow analysis."""

        try:
            raw = await asyncio.wait_for(
                self.llm.complete(
                    messages=[{"role": "user", "content": prompt}],
                    system=SYSTEM.format(count=question_count),
                    max_tokens=16000,
                ),
                timeout=10.0, # Bumped to 10s for more stability
            )
            if raw and raw.strip():
                data = extract_json(raw)
                questions = data if isinstance(data, list) else data.get("questions", [])
                if len(questions) >= (question_count // 2 + 1): # Expect at least half
                    return questions[:question_count]
                logger.warning("LLM returned only %d questions, using static fallback", len(questions))
        except asyncio.TimeoutError:
            logger.warning("Question generation exceeded timeout — using static fallback")
        except Exception as exc:
            logger.warning("LLM question generation failed, using static fallback: %s", exc)

        logger.info("Using static question generation fallback")
        return _generate_fallback_questions(code_snippet, concepts, language, question_count=question_count)


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
