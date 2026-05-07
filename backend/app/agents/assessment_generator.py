"""
Assessment Generator Agent — creates 10 targeted questions from the user's code.
"""
import logging
import re
from app.services.llm import get_llm_provider
from app.agents.utils import extract_json

logger = logging.getLogger(__name__)

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



_CONCEPT_QUESTIONS: dict[str, list[dict]] = {
    "loops": [
        {
            "question": "What does a `for` loop do in your code?",
            "options": [
                {"key": "A", "text": "Repeats a block of code a set number of times"},
                {"key": "B", "text": "Defines a new function"},
                {"key": "C", "text": "Stores a value in a variable"},
                {"key": "D", "text": "Imports a module"},
            ],
            "correct": "A",
            "topic": "loops",
            "difficulty": "beginner",
            "code_reference": "loop statement",
            "explanation": "A `for` loop iterates over a sequence, executing the body once per item.",
        },
        {
            "question": "When does a `while` loop stop executing?",
            "options": [
                {"key": "A", "text": "When its condition becomes False"},
                {"key": "B", "text": "After exactly 10 iterations"},
                {"key": "C", "text": "When a function is called"},
                {"key": "D", "text": "When a variable is assigned"},
            ],
            "correct": "A",
            "topic": "loops",
            "difficulty": "beginner",
            "code_reference": "while condition",
            "explanation": "A `while` loop keeps running as long as its condition is True; it stops when the condition evaluates to False.",
        },
    ],
    "functions": [
        {
            "question": "What keyword is used to define a function in your code?",
            "options": [
                {"key": "A", "text": "`def`"},
                {"key": "B", "text": "`class`"},
                {"key": "C", "text": "`for`"},
                {"key": "D", "text": "`import`"},
            ],
            "correct": "A",
            "topic": "functions",
            "difficulty": "beginner",
            "code_reference": "function definition",
            "explanation": "In Python, `def` is used to define a reusable block of code called a function.",
        },
        {
            "question": "What does the `return` statement do inside a function?",
            "options": [
                {"key": "A", "text": "Sends a value back to the caller"},
                {"key": "B", "text": "Prints the value to the screen"},
                {"key": "C", "text": "Stops the entire program"},
                {"key": "D", "text": "Creates a new variable"},
            ],
            "correct": "A",
            "topic": "functions",
            "difficulty": "beginner",
            "code_reference": "return statement",
            "explanation": "`return` exits the function and passes the specified value back to wherever the function was called.",
        },
    ],
    "conditionals": [
        {
            "question": "What does an `if` statement do?",
            "options": [
                {"key": "A", "text": "Runs a block of code only when a condition is True"},
                {"key": "B", "text": "Loops over a list"},
                {"key": "C", "text": "Defines a function"},
                {"key": "D", "text": "Imports a library"},
            ],
            "correct": "A",
            "topic": "conditionals",
            "difficulty": "beginner",
            "code_reference": "if statement",
            "explanation": "An `if` statement checks a condition and executes its body only when that condition is True.",
        },
    ],
    "variables": [
        {
            "question": "What is a variable used for in programming?",
            "options": [
                {"key": "A", "text": "Storing a value so it can be used later"},
                {"key": "B", "text": "Defining a loop"},
                {"key": "C", "text": "Importing a module"},
                {"key": "D", "text": "Printing output"},
            ],
            "correct": "A",
            "topic": "variables",
            "difficulty": "beginner",
            "code_reference": "variable assignment",
            "explanation": "Variables hold data values in memory so they can be referenced and modified throughout a program.",
        },
    ],
    "lists": [
        {
            "question": "How do you access the first element of a list named `items` in Python?",
            "options": [
                {"key": "A", "text": "`items[0]`"},
                {"key": "B", "text": "`items[1]`"},
                {"key": "C", "text": "`items.first()`"},
                {"key": "D", "text": "`items.get(0)`"},
            ],
            "correct": "A",
            "topic": "lists",
            "difficulty": "beginner",
            "code_reference": "list indexing",
            "explanation": "Python lists are zero-indexed, so `items[0]` gives the first element.",
        },
    ],
    "strings": [
        {
            "question": "Which of these correctly concatenates two strings in Python?",
            "options": [
                {"key": "A", "text": '`"hello" + " world"`'},
                {"key": "B", "text": '`"hello" * " world"`'},
                {"key": "C", "text": '`"hello" - " world"`'},
                {"key": "D", "text": '`"hello" / " world"`'},
            ],
            "correct": "A",
            "topic": "strings",
            "difficulty": "beginner",
            "code_reference": "string operation",
            "explanation": "The `+` operator joins (concatenates) two strings together.",
        },
    ],
    "error_handling": [
        {
            "question": "What is the purpose of a `try`/`except` block?",
            "options": [
                {"key": "A", "text": "To catch and handle errors without crashing the program"},
                {"key": "B", "text": "To define a function"},
                {"key": "C", "text": "To create a loop"},
                {"key": "D", "text": "To import a module"},
            ],
            "correct": "A",
            "topic": "error_handling",
            "difficulty": "beginner",
            "code_reference": "try/except block",
            "explanation": "`try`/`except` lets the program attempt risky code and recover gracefully if an exception is raised.",
        },
    ],
    "classes": [
        {
            "question": "What is a class in object-oriented programming?",
            "options": [
                {"key": "A", "text": "A blueprint for creating objects with shared attributes and methods"},
                {"key": "B", "text": "A type of loop"},
                {"key": "C", "text": "A built-in function"},
                {"key": "D", "text": "A way to import modules"},
            ],
            "correct": "A",
            "topic": "classes",
            "difficulty": "beginner",
            "code_reference": "class definition",
            "explanation": "A class defines a template for objects, bundling related data (attributes) and behaviour (methods) together.",
        },
    ],
    "recursion": [
        {
            "question": "What makes a function recursive?",
            "options": [
                {"key": "A", "text": "It calls itself within its own body"},
                {"key": "B", "text": "It uses a `for` loop"},
                {"key": "C", "text": "It imports another module"},
                {"key": "D", "text": "It returns `None`"},
            ],
            "correct": "A",
            "topic": "recursion",
            "difficulty": "intermediate",
            "code_reference": "recursive call",
            "explanation": "A recursive function solves a problem by calling itself with a smaller sub-problem until a base case is reached.",
        },
    ],
    "dictionaries": [
        {
            "question": "How do you access the value for key `'name'` in a dictionary `d`?",
            "options": [
                {"key": "A", "text": "`d['name']`"},
                {"key": "B", "text": "`d.name`"},
                {"key": "C", "text": "`d[0]`"},
                {"key": "D", "text": "`d.get_key('name')`"},
            ],
            "correct": "A",
            "topic": "dictionaries",
            "difficulty": "beginner",
            "code_reference": "dictionary access",
            "explanation": "Dictionary values are retrieved by their key using square-bracket notation: `d['name']`.",
        },
    ],
}

_GENERIC_QUESTIONS = [
    {
        "question": "What is the purpose of indentation in Python code?",
        "options": [
            {"key": "A", "text": "It defines code blocks such as loops, functions, and conditionals"},
            {"key": "B", "text": "It is purely decorative and has no effect"},
            {"key": "C", "text": "It speeds up execution"},
            {"key": "D", "text": "It imports modules automatically"},
        ],
        "correct": "A",
        "topic": "variables",
        "difficulty": "beginner",
        "code_reference": "indentation",
        "explanation": "Python uses indentation to define the scope and structure of code blocks instead of curly braces.",
    },
    {
        "question": "What does `print()` do in Python?",
        "options": [
            {"key": "A", "text": "Outputs text or values to the console"},
            {"key": "B", "text": "Saves data to a file"},
            {"key": "C", "text": "Defines a new variable"},
            {"key": "D", "text": "Creates a loop"},
        ],
        "correct": "A",
        "topic": "input_output",
        "difficulty": "beginner",
        "code_reference": "print statement",
        "explanation": "`print()` displays the given value(s) on the standard output (usually the terminal).",
    },
    {
        "question": "Which of the following is a valid variable name in Python?",
        "options": [
            {"key": "A", "text": "`my_value`"},
            {"key": "B", "text": "`2nd_value`"},
            {"key": "C", "text": "`my-value`"},
            {"key": "D", "text": "`class`"},
        ],
        "correct": "A",
        "topic": "variables",
        "difficulty": "beginner",
        "code_reference": "variable name",
        "explanation": "Variable names must start with a letter or underscore, contain only letters/digits/underscores, and cannot be reserved keywords.",
    },
    {
        "question": "What does `==` check in Python?",
        "options": [
            {"key": "A", "text": "Whether two values are equal"},
            {"key": "B", "text": "Whether a variable has been assigned"},
            {"key": "C", "text": "Whether two variables point to the same object"},
            {"key": "D", "text": "Whether a number is positive"},
        ],
        "correct": "A",
        "topic": "operators",
        "difficulty": "beginner",
        "code_reference": "comparison operator",
        "explanation": "`==` is the equality operator; it returns `True` when both sides have the same value.",
    },
    {
        "question": "What is a `list` in Python?",
        "options": [
            {"key": "A", "text": "An ordered, mutable collection of items"},
            {"key": "B", "text": "A fixed mapping of keys to values"},
            {"key": "C", "text": "A single integer value"},
            {"key": "D", "text": "A function definition"},
        ],
        "correct": "A",
        "topic": "lists",
        "difficulty": "beginner",
        "code_reference": "list literal",
        "explanation": "A list stores multiple items in order and can be changed (mutated) after creation.",
    },
]


def _generate_fallback_questions(code_snippet: str, concepts: list[str], language: str) -> list[dict]:
    questions: list[dict] = []
    used_topics: set[str] = set()

    for concept in concepts:
        if concept in _CONCEPT_QUESTIONS:
            for q in _CONCEPT_QUESTIONS[concept]:
                if q["topic"] not in used_topics:
                    questions.append(q)
                    used_topics.add(q["topic"])
                if len(questions) >= 8:
                    break
        if len(questions) >= 8:
            break

    for q in _GENERIC_QUESTIONS:
        if len(questions) >= 10:
            break
        if q["topic"] not in used_topics:
            questions.append(q)
            used_topics.add(q["topic"])

    # Pad if still short
    i = 0
    while len(questions) < 10:
        questions.append(_GENERIC_QUESTIONS[i % len(_GENERIC_QUESTIONS)])
        i += 1

    # Assign stable IDs
    return [{"id": f"q{i+1}", **q} for i, q in enumerate(questions[:10])]


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

        try:
            raw = await self.llm.complete(
                messages=[{"role": "user", "content": prompt}],
                system=SYSTEM,
                max_tokens=16000,
            )
            if raw and raw.strip():
                data = extract_json(raw)
                questions = data if isinstance(data, list) else data.get("questions", [])
                if len(questions) >= 5:
                    return questions
                logger.warning("LLM returned only %d questions, using static fallback", len(questions))
        except Exception as exc:
            logger.warning("LLM question generation failed, using static fallback: %s", exc)

        logger.info("Using static question generation fallback")
        return _generate_fallback_questions(code_snippet, concepts, language)


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
