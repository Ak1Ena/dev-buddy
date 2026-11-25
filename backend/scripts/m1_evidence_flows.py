"""M1 evidence: real generations through the AI gateway, then every agent flow.

Not used by the app. Run after scripts/m1_evidence_connections.py, against the same DB:
  DATABASE_URL=sqlite+aiosqlite:////tmp/nexora-m1-evidence.db PYTHONPATH=. \
      .venv/bin/python scripts/m1_evidence_flows.py
It reuses the ev_* users and their saved (encrypted) credentials. Agent outputs are
trimmed. Keys are never printed; the output is checked for every .env key value at the end.
"""
from __future__ import annotations

import asyncio
import io
import json
import sys
import time

from sqlalchemy import select

from app import database
from app.agents.assessment_generator import AssessmentGeneratorAgent
from app.agents.choreographer import ChoreographerAgent
from app.agents.code_analyzer import CodeAnalyzerAgent
from app.agents.designer import DesignerAgent
from app.agents.lesson_suggester import LessonSuggesterAgent
from app.agents.planner import PlannerAgent
from app.agents.socratic_mentor import SocraticMentorAgent
from app.ai_gateway import AIGateway, GatewayError, GenerateRequest, get_gateway
from app.ai_gateway.types import ResolvedConfig
from app.ai_gateway.usage import flush_usage
from app.config import get_settings
from app.models.ai import AIUsage
from app.models.user import User

s = get_settings()
KEYS = [k.get_secret_value() for k in (s.gemini_api_key, s.openrouter_api_key, s.openwebui_api_key,
                                       s.anthropic_api_key, s.openai_api_key) if k.get_secret_value()]
_out = io.StringIO()

# OpenRouter's free gemma-4-31b (same family as the .env default). On 2026-11-25 Gemini 3.8-flash
# answered 503 "high demand" and the Ollama cloud model answered 401, so neither could carry the flows.
FLOW_USER = sys.argv[1] if len(sys.argv) > 1 else "ev_openrouter"
CODE = '''def average(nums):
    total = 0
    for n in nums:
        total += n
    return total / len(nums)

print(average([3, 4, 5]))
print(average([]))
'''


def say(text: str = "") -> None:
    print(text, flush=True)
    _out.write(text + "\n")


def trim(value, n: int = 500) -> str:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    text = " ".join(text.split())
    return text if len(text) <= n else text[:n] + f" … [{len(text) - n} more chars trimmed]"


async def user_id(name: str) -> str:
    async with database.AsyncSessionLocal() as db:
        return (await db.execute(select(User.id).where(User.username == name))).scalar_one()


async def ping(gw: AIGateway, label: str) -> None:
    say(f"$ gateway.complete(user={label}, prompt='Reply with the single word: pong')")
    t0 = time.monotonic()
    try:
        cfg = await gw.get_config()
        res = await gw.complete(GenerateRequest(
            [{"role": "user", "content": "Reply with the single word: pong"}], max_tokens=300, agent="evidence"))
        say(f"-> ok in {int((time.monotonic() - t0) * 1000)} ms | {cfg.provider} / {cfg.model} "
            f"(source={cfg.source}) | text={res.text.strip()[:80]!r} | "
            f"tokens in/out={res.usage.input_tokens}/{res.usage.output_tokens}")
    except GatewayError as e:
        say(f"-> GatewayError code={e.code} message={e.message!r}")


async def step(title: str, coro) -> None:
    say(f"$ {title}")
    t0 = time.monotonic()
    try:
        out = await coro
        say(f"-> ok in {int((time.monotonic() - t0) * 1000)} ms: {trim(out)}")
    except Exception as e:  # show the typed error and keep going to the next flow
        say(f"-> FAILED {type(e).__name__}: {e}")


async def main() -> int:
    say("## one real generation per saved provider credential (user's text slot)")
    for name, label in [("ev_gemini", "gemini LIVE"), ("ev_openrouter", "openrouter LIVE"),
                        ("ev_ollama", "ollama LIVE"), ("ev_lmstudio", "lmstudio LIVE via Ollama /v1"),
                        ("ev_vllm", "vllm LIVE via Ollama /v1"),
                        ("ev_openai_compatible", "openai_compatible LIVE via Ollama /v1"),
                        ("ev_anthropic", "anthropic stub, not live"), ("ev_openai", "openai stub, not live")]:
        await ping(get_gateway(await user_id(name)), f"{name}, {label}")
    say("$ live slot: gateway(user=ev_ollama, slot='live')")
    await ping(get_gateway(await user_id("ev_ollama"), "live"), "ev_ollama live slot, ollama LIVE")

    say()
    say("## openwebui (LIVE, dev .env only, not user-selectable): connection test + generation")
    cfg = ResolvedConfig(provider="openwebui", model="", base_url=s.openwebui_base_url,
                         api_key=s.openwebui_api_key.get_secret_value(), source="env")
    status = await AIGateway(config=cfg).validate_connection()
    say(f"$ AIGateway(openwebui from .env).validate_connection()")
    say(f"-> ok={status.ok} latency_ms={status.latency_ms} model_count={status.model_count} "
        f"error_code={status.error_code} first_ids={[m.id for m in status.models[:5]]}")
    if status.ok and status.models:
        cfg = ResolvedConfig(provider="openwebui", model=status.models[0].id, base_url=s.openwebui_base_url,
                             api_key=s.openwebui_api_key.get_secret_value(), source="env")
        await ping(AIGateway(config=cfg), "openwebui from .env")

    say()
    uid = await user_id(FLOW_USER)
    gw = get_gateway(uid)
    cfg = await gw.get_config()
    say(f"## smoke run of every agent flow through the gateway, as user {FLOW_USER}: "
        f"{cfg.provider} / {cfg.model} (source={cfg.source}). Outputs trimmed.")
    analysis: dict = {}

    async def analyze():
        analysis.update(await CodeAnalyzerAgent(uid).analyze(CODE))
        return analysis
    await step("CodeAnalyzerAgent(user).analyze(CODE)", analyze())
    concepts = analysis.get("concepts") or ["loops", "functions", "division"]
    language = analysis.get("language") or "python"
    await step("AssessmentGeneratorAgent(user).generate_questions(CODE, concepts, language, question_count=3)",
               AssessmentGeneratorAgent(uid).generate_questions(CODE, concepts, language, question_count=3))
    planner = PlannerAgent(uid)
    await step("PlannerAgent(user).generate_space_name(...)",
               planner.generate_space_name(language, concepts, analysis.get("summary"), "beginner"))
    await step("PlannerAgent(user).generate_learning_path(...)",
               planner.generate_learning_path(CODE, language, concepts, "beginner",
                                              ["edge cases"], ["loops"], 60))
    await step("PlannerAgent(user).generate_lesson_content(...)",
               planner.generate_lesson_content("Empty list edge case", "Dividing by zero", language,
                                               "beginner", CODE, ["edge cases"]))
    await step("DesignerAgent(user).generate_animation(...)",
               DesignerAgent(uid).generate_animation("loops", "Summing a list", language, CODE))
    await step("ChoreographerAgent(user).choreograph(CODE)", ChoreographerAgent(uid).choreograph(CODE))
    convo = [{"role": "user", "content": "my average function crashes on an empty list, why?"},
             {"role": "assistant", "content": "What happens to len(nums) when the list is empty?"},
             {"role": "user", "content": "it is 0... so I divide by zero? I keep getting confused by edge cases"}]
    await step("LessonSuggesterAgent(user).suggest(convo)", LessonSuggesterAgent(uid).suggest(convo))
    mentor = SocraticMentorAgent(uid)
    await step("SocraticMentorAgent(user).chat('my code crashes on [], fix it for me', hint_level=0)",
               mentor.chat("my code crashes on [], fix it for me", [], code_context=CODE, hint_level=0))

    async def stream():
        chunks = [c async for c in mentor.stream_chat("why does average([]) crash?", [],
                                                       code_context=CODE, hint_level=1)]
        return f"{len(chunks)} chunks: " + "".join(chunks)
    await step("SocraticMentorAgent(user).stream_chat('why does average([]) crash?', hint_level=1)", stream())

    await flush_usage()
    say()
    say("## ai_usage rows written by the calls above (no prompt, reply or key is stored)")
    async with database.AsyncSessionLocal() as db:
        rows = (await db.execute(select(AIUsage).order_by(AIUsage.started_at))).scalars().all()
    say("agent | provider | model | source | ok | error_code | in/out tokens | latency_ms")
    for r in rows:
        say(f"{r.agent} | {r.provider} | {r.model} | {r.source} | {r.ok} | {r.error_code} | "
            f"{r.input_tokens}/{r.output_tokens} | {r.latency_ms}")

    leaked = any(k in _out.getvalue() or k[4:-4] in _out.getvalue() for k in KEYS)
    say()
    say(f"# leak check of this output against the .env key values: {'FOUND' if leaked else 'none found'}")
    await database.engine.dispose()
    return 3 if leaked else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
