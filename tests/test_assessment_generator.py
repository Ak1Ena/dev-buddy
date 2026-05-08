import pytest
from app.agents.assessment_generator import AssessmentGeneratorAgent, _generate_fallback_questions

@pytest.mark.asyncio
async def test_generate_questions_structure():
    agent = AssessmentGeneratorAgent()
    code = "def add(a, b):\n    return a + b"
    concepts = ["functions", "variables", "operators"]
    language = "python"
    
    # This might call the LLM if configured, or fallback
    questions = await agent.generate_questions(code, concepts, language)
    
    assert len(questions) == 10
    for q in questions:
        assert "id" in q
        assert "question" in q
        assert "options" in q
        assert len(q["options"]) == 4
        assert "correct" in q
        assert "topic" in q

def test_fallback_questions_logic_focused():
    code = "def dummy(): pass"
    concepts = ["functions"]
    language = "python"
    
    questions = _generate_fallback_questions(code, concepts, language)
    
    assert len(questions) == 10
    # Check if some questions are from our new logic-focused fallback
    found_logic_q = False
    for q in questions:
        if "Looking at the loop" in q["question"] or "Based on the function" in q["question"]:
            found_logic_q = True
            break
    assert found_logic_q, "Fallback should include logic-focused questions"

def test_fallback_no_syntax_q():
    code = "x = 1"
    concepts = ["variables"]
    language = "python"
    
    questions = _generate_fallback_questions(code, concepts, language)
    
    for q in questions:
        # These were the old generic questions we wanted to avoid
        assert "What keyword is used to define" not in q["question"]
        assert "What does 'if' mean" not in q["question"]
