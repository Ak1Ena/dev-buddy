"""
Static assessment question bank + scoring logic.
10 questions covering Python/JavaScript fundamentals, graded by topic and difficulty.
"""
from dataclasses import dataclass

PYTHON_QUESTIONS = [
    {
        "id": "py_q1",
        "question": "What is the output of: print(type(3.14))?",
        "options": [
            {"key": "A", "text": "<class 'int'>"},
            {"key": "B", "text": "<class 'float'>"},
            {"key": "C", "text": "<class 'str'>"},
            {"key": "D", "text": "<class 'number'>"},
        ],
        "correct": "B",
        "topic": "data_types",
        "difficulty": "beginner",
    },
    {
        "id": "py_q2",
        "question": "What does this code print?\nx = 5\nif x > 3:\n    print('A')\nelif x > 4:\n    print('B')\nelse:\n    print('C')",
        "options": [
            {"key": "A", "text": "A"},
            {"key": "B", "text": "B"},
            {"key": "C", "text": "C"},
            {"key": "D", "text": "A and B"},
        ],
        "correct": "A",
        "topic": "conditionals",
        "difficulty": "beginner",
    },
    {
        "id": "py_q3",
        "question": "How many times does 'hello' print?\nfor i in range(3):\n    print('hello')",
        "options": [
            {"key": "A", "text": "2"},
            {"key": "B", "text": "3"},
            {"key": "C", "text": "4"},
            {"key": "D", "text": "0"},
        ],
        "correct": "B",
        "topic": "loops",
        "difficulty": "beginner",
    },
    {
        "id": "py_q4",
        "question": "What is the value of result?\ndef add(a, b):\n    return a + b\nresult = add(3, 4)",
        "options": [
            {"key": "A", "text": "None"},
            {"key": "B", "text": "34"},
            {"key": "C", "text": "7"},
            {"key": "D", "text": "Error"},
        ],
        "correct": "C",
        "topic": "functions",
        "difficulty": "beginner",
    },
    {
        "id": "py_q5",
        "question": "What does len([1, 2, 3, 4]) return?",
        "options": [
            {"key": "A", "text": "3"},
            {"key": "B", "text": "4"},
            {"key": "C", "text": "5"},
            {"key": "D", "text": "[4]"},
        ],
        "correct": "B",
        "topic": "lists",
        "difficulty": "beginner",
    },
    {
        "id": "py_q6",
        "question": "What is the output?\nmy_list = [1, 2, 3]\nmy_list.append(4)\nprint(my_list[2])",
        "options": [
            {"key": "A", "text": "3"},
            {"key": "B", "text": "4"},
            {"key": "C", "text": "2"},
            {"key": "D", "text": "IndexError"},
        ],
        "correct": "A",
        "topic": "lists",
        "difficulty": "beginner",
    },
    {
        "id": "py_q7",
        "question": "What does this print?\ncount = 0\nwhile count < 3:\n    count += 1\nprint(count)",
        "options": [
            {"key": "A", "text": "0"},
            {"key": "B", "text": "2"},
            {"key": "C", "text": "3"},
            {"key": "D", "text": "4"},
        ],
        "correct": "C",
        "topic": "loops",
        "difficulty": "beginner",
    },
    {
        "id": "py_q8",
        "question": "What is the output of: print('hello'[1])?",
        "options": [
            {"key": "A", "text": "h"},
            {"key": "B", "text": "e"},
            {"key": "C", "text": "hello"},
            {"key": "D", "text": "Error"},
        ],
        "correct": "B",
        "topic": "strings",
        "difficulty": "beginner",
    },
    {
        "id": "py_q9",
        "question": "What happens if a 'try' block succeeds without any errors?",
        "options": [
            {"key": "A", "text": "The 'except' block is skipped"},
            {"key": "B", "text": "The 'except' block runs anyway"},
            {"key": "C", "text": "The program crashes"},
            {"key": "D", "text": "The function restarts"},
        ],
        "correct": "A",
        "topic": "error_handling",
        "difficulty": "intermediate",
    },
    {
        "id": "py_q10",
        "question": "What is the final value of 'res' in this logic?\ndef process(n):\n    if n < 5:\n        return n * 2\n    return n + 2\nres = process(3)",
        "options": [
            {"key": "A", "text": "6"},
            {"key": "B", "text": "5"},
            {"key": "C", "text": "10"},
            {"key": "D", "text": "3"},
        ],
        "correct": "A",
        "topic": "functions",
        "difficulty": "beginner",
    },
]

JS_QUESTIONS = [
    {
        "id": "js_q1",
        "question": "What does typeof 42 return in JavaScript?",
        "options": [
            {"key": "A", "text": "'int'"},
            {"key": "B", "text": "'number'"},
            {"key": "C", "text": "'float'"},
            {"key": "D", "text": "'integer'"},
        ],
        "correct": "B",
        "topic": "data_types",
        "difficulty": "beginner",
    },
    {
        "id": "js_q2",
        "question": "What is the output?\nlet x = 5;\nif (x > 3) { console.log('A'); } else { console.log('B'); }",
        "options": [
            {"key": "A", "text": "A"},
            {"key": "B", "text": "B"},
            {"key": "C", "text": "undefined"},
            {"key": "D", "text": "Error"},
        ],
        "correct": "A",
        "topic": "conditionals",
        "difficulty": "beginner",
    },
    # ... (abbreviated — full bank has 10 JS questions)
]

QUESTION_BANKS = {
    "python": PYTHON_QUESTIONS,
    "javascript": JS_QUESTIONS,
}


@dataclass
class ScoreResult:
    score: int
    skill_level: str
    strong_areas: list[str]
    weak_areas: list[str]
    recommendation: str


def get_questions(language: str) -> list[dict]:
    bank = QUESTION_BANKS.get(language, PYTHON_QUESTIONS)
    return [
        {
            "id": q["id"],
            "question": q["question"],
            "options": q["options"],
            "topic": q["topic"],
            "difficulty": q["difficulty"],
        }
        for q in bank
    ]


def check_answer(language: str, question_id: str, answer_key: str) -> dict:
    bank = QUESTION_BANKS.get(language, PYTHON_QUESTIONS)
    for q in bank:
        if q["id"] == question_id:
            return {
                "is_correct": q["correct"] == answer_key,
                "correct_answer": q["correct"],
                "question_text": q["question"],
                "topic": q["topic"],
                "difficulty": q["difficulty"],
            }
    raise ValueError(f"Question {question_id} not found")


def calculate_score(answers: list[dict]) -> ScoreResult:
    total = len(answers)
    if total == 0:
        return ScoreResult(0, "beginner", [], [], "Start with the basics!")

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
        recommendation = "Great foundation! We'll build on your strengths and fill any gaps."
    elif score >= 50:
        skill_level = "beginner"
        recommendation = "Good start! Your learning path will reinforce weak spots and build new skills."
    else:
        skill_level = "beginner"
        recommendation = "No worries — everyone starts somewhere! We'll begin with the fundamentals and build step by step."

    return ScoreResult(score, skill_level, strong_areas, weak_areas, recommendation)
