import pytest
from app.agents.assessment_agent import get_questions, check_answer, calculate_score


def test_get_python_questions():
    questions = get_questions("python")
    assert len(questions) == 10
    for q in questions:
        assert "id" in q
        assert "question" in q
        assert "options" in q
        assert len(q["options"]) == 4


def test_check_correct_answer():
    result = check_answer("python", "py_q1", "B")
    assert result["is_correct"] is True
    assert result["topic"] == "data_types"


def test_check_wrong_answer():
    result = check_answer("python", "py_q1", "A")
    assert result["is_correct"] is False
    assert result["correct_answer"] == "B"


def test_calculate_score_all_correct():
    answers = [{"is_correct": True, "topic": "variables"} for _ in range(10)]
    result = calculate_score(answers)
    assert result.score == 100
    assert result.skill_level == "intermediate"


def test_calculate_score_all_wrong():
    answers = [{"is_correct": False, "topic": "loops"} for _ in range(10)]
    result = calculate_score(answers)
    assert result.score == 0
    assert result.skill_level == "beginner"
    assert "loops" in result.weak_areas


def test_calculate_score_mixed():
    answers = [
        {"is_correct": True, "topic": "variables"},
        {"is_correct": True, "topic": "variables"},
        {"is_correct": False, "topic": "loops"},
        {"is_correct": False, "topic": "loops"},
        {"is_correct": False, "topic": "loops"},
    ]
    result = calculate_score(answers)
    assert result.score == 40
    assert "loops" in result.weak_areas
    assert "variables" in result.strong_areas
