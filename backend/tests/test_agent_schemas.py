"""Agents on complete_json (roadmap M1 step 4): response shapes kept for the
frontend, one retry with the reason on a bad reply, fallbacks unchanged, and
prompts unchanged (no schema text added)."""
import json
import pathlib

from app.agents import assessment_generator, choreographer, code_analyzer, designer, lesson_suggester, planner
from app.agents.assessment_generator import AssessmentGeneratorAgent
from app.agents.choreographer import ChoreographerAgent
from app.agents.code_analyzer import CodeAnalyzerAgent
from app.agents.designer import DesignerAgent
from app.agents.lesson_suggester import LessonSuggesterAgent
from app.agents.planner import PlannerAgent
from tests.conftest import FakeProvider, fake_gateway

CODE = "total = 0\nfor n in [1, 2, 3]:\n    total += n\nprint(total)\n"


def _agent(cls, replies):
    adapter = FakeProvider(replies)
    return cls(gateway=fake_gateway(adapter)), adapter


def _retried(adapter) -> bool:
    return len(adapter.calls) == 2 and "not usable" in adapter.calls[1]["messages"][-1]["content"]


# ── code_analyzer ────────────────────────────────────────────────────────────
async def test_code_analyzer_keeps_extra_keys_and_prompt():
    reply = {"is_code": True, "language": "python", "concepts": ["loops"], "complexity": "low"}
    agent, adapter = _agent(CodeAnalyzerAgent, [json.dumps(reply)])
    assert await agent.analyze(CODE) == reply
    assert adapter.calls[0]["system"] == code_analyzer.SYSTEM


async def test_code_analyzer_non_code_passes_through():
    reply = {"is_code": False, "message": "That looks like a question, not code."}
    agent, _ = _agent(CodeAnalyzerAgent, [json.dumps(reply)])
    assert await agent.analyze("how do loops work?") == reply


async def test_code_analyzer_retries_then_falls_back_to_static():
    agent, adapter = _agent(CodeAnalyzerAgent, ['{"is_code": true, "language": "python"}'])  # no concepts
    out = await agent.analyze(CODE)
    assert _retried(adapter)
    assert out == code_analyzer._static_analyze(CODE)


async def test_misconceptions_accept_wrapped_object_and_filter():
    items = [{"error_category": "logic_error", "misconception_type": "off_by_one", "confidence_score": 0.9},
             {"error_category": "logic_error", "misconception_type": "weak", "confidence_score": 0.1}]
    agent, adapter = _agent(CodeAnalyzerAgent, [json.dumps({"misconceptions": items})])
    out = await agent.detect_misconceptions(CODE)
    assert [m["misconception_type"] for m in out] == ["off_by_one"]
    assert adapter.calls[0]["system"] == code_analyzer.MISCONCEPTION_SYSTEM


# ── assessment_generator ─────────────────────────────────────────────────────
def _question(i: int) -> dict:
    return {"id": f"q{i}", "question": f"What is total after step {i}?", "correct": "a", "topic": "loops",
            "options": [{"key": k, "text": k.upper()} for k in "abcd"]}


async def test_assessment_bare_list_is_accepted():
    agent, adapter = _agent(AssessmentGeneratorAgent, [json.dumps([_question(i) for i in range(1, 5)])])
    out = await agent.generate_questions(CODE, ["loops"], "python", question_count=4)
    assert [q["id"] for q in out] == ["q1", "q2", "q3", "q4"]
    assert adapter.calls[0]["system"] == assessment_generator.SYSTEM.format(count=4)


async def test_assessment_salvages_questions_from_malformed_reply():
    # Truncated JSON both times: complete question objects are still kept (raw_text path).
    broken = '{"questions": [' + ", ".join(json.dumps(_question(i)) for i in range(1, 5)) + ', {"id": "q5", "quest'
    agent, adapter = _agent(AssessmentGeneratorAgent, [broken])
    out = await agent.generate_questions(CODE, ["loops"], "python", question_count=4)
    assert _retried(adapter)
    assert [q["id"] for q in out] == ["q1", "q2", "q3", "q4"]


# ── planner ──────────────────────────────────────────────────────────────────
LESSONS = [{"order_index": 1, "title": "Loops", "topic": "loops", "estimated_minutes": 15},
           {"order_index": 2, "title": "Functions", "topic": "functions"}]


async def test_planner_bare_list_gets_default_title_and_keeps_lesson_keys():
    agent, adapter = _agent(PlannerAgent, [json.dumps(LESSONS)])
    out = await agent.generate_topic_path("loops", "python", "beginner")
    assert out == {"lessons": LESSONS, "title": "Learning loops", "description": ""}
    assert adapter.calls[0]["system"] == planner.TOPIC_PLANNER_SYSTEM


async def test_planner_retries_lesson_missing_topic_with_reason():
    bad = json.dumps({"title": "Path", "lessons": [{"order_index": 1, "title": "Loops"}]})
    good = json.dumps({"title": "Path", "description": "d", "lessons": LESSONS})
    agent, adapter = _agent(PlannerAgent, [bad, good])
    out = await agent.generate_topic_path("loops", "python", "beginner")
    assert _retried(adapter)
    assert "topic" in adapter.calls[1]["messages"][-1]["content"]
    assert out["title"] == "Path" and out["lessons"] == LESSONS


async def test_planner_learning_path_falls_back_when_replies_stay_bad():
    # 1st reply feeds detect_misconceptions; then the path reply is never usable.
    agent, _ = _agent(PlannerAgent, ["[]", "no json here"])
    out = await agent.generate_learning_path(CODE, "python", ["loops"], "beginner", ["loops"], [], 40)
    assert out == planner._build_fallback_path(["loops"], ["loops"], "python")


async def test_lesson_content_picks_content_object_from_siblings():
    reply = '{"note": "x"}\n{"concept_hook": "Why loops?", "explanation": "e"}'
    agent, adapter = _agent(PlannerAgent, [reply])
    out = await agent.generate_lesson_content("loops", "Loops", "python", "beginner", CODE, [])
    assert out == {"concept_hook": "Why loops?", "explanation": "e"}
    assert adapter.calls[0]["system"] == planner.CONTENT_SYSTEM


# ── designer ─────────────────────────────────────────────────────────────────
async def test_designer_bare_frames_list_is_wrapped():
    frames = [{"title": "Start", "narration": "total is 0"}]
    agent, adapter = _agent(DesignerAgent, [json.dumps(frames)])
    out = await agent.generate_animation("loops", "Loops", "python", CODE)
    assert out == {"animation_frames": frames}
    assert adapter.calls[0]["system"] == designer.DESIGNER_SYSTEM


async def test_designer_falls_back_on_empty_object():
    agent, adapter = _agent(DesignerAgent, ["{}"])
    out = await agent.generate_animation("loops", "Loops", "python", CODE)
    assert _retried(adapter)
    assert out == designer._fallback_animation("loops", "Loops", "python", CODE)


# ── choreographer ────────────────────────────────────────────────────────────
async def test_choreographer_keeps_scene_shape_and_falls_back():
    scene = {"version": "1.0", "metadata": {"title": "Sum"}, "timeline": [{"t": 0, "action": "show"}]}
    agent, adapter = _agent(ChoreographerAgent, [json.dumps(scene)])
    assert await agent.choreograph(CODE) == scene
    assert adapter.calls[0]["system"] == choreographer.SYSTEM_PROMPT

    agent, _ = _agent(ChoreographerAgent, ['{"version": "1.0"}'])  # no timeline
    assert (await agent.choreograph(CODE))["timeline"] == []


# ── lesson_suggester ─────────────────────────────────────────────────────────
async def test_lesson_suggester_shapes():
    convo = [{"role": "user", "content": "I still don't get the loop"}]
    spec = {"should_create": True, "topic": "loops", "title": "Loop by loop", "why": "w"}
    agent, adapter = _agent(LessonSuggesterAgent, [json.dumps(spec)])
    assert await agent.suggest(convo) == spec
    assert adapter.calls[0]["system"] == lesson_suggester.SUGGESTER_SYSTEM

    agent, _ = _agent(LessonSuggesterAgent, ['{"should_create": false}'])
    assert await agent.suggest(convo) is None

    agent, adapter = _agent(LessonSuggesterAgent, ['{"should_create": true, "topic": "loops"}'])  # no title
    assert await agent.suggest(convo) is None
    assert _retried(adapter)


# ── no agent parses JSON on its own any more ─────────────────────────────────
def test_no_agent_uses_extract_json():
    agents = pathlib.Path(__file__).resolve().parent.parent / "app" / "agents"
    for f in agents.glob("*.py"):
        assert "extract_json" not in f.read_text(), f.name
