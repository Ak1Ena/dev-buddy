"""
Designer Agent — generates cinematic animation frames with canvas scenes and
particle effects for a lesson. Separated from the Planner so visual design has
its own model, prompt, and token budget.
"""
import logging
from app.services.llm import get_llm_provider
from app.agents.utils import extract_json

logger = logging.getLogger(__name__)

DESIGNER_SYSTEM = """You are a visual animation designer for programming education.
Given a code snippet and a lesson topic, design a frame-by-frame cinematic walkthrough
that shows exactly what the code does — visually, step by step.

Return ONLY valid JSON — no markdown, no extra text:
{
  "animation_frames": [
    {
      "frame": 1,
      "title": "Short cinematic title for this moment",
      "code_state": "The 1-3 most relevant lines at this exact moment",
      "canvas_scene": {
        "nodes": [
          {
            "id": "a",
            "type": "variable",
            "label": "energy_budget",
            "value": "10.0",
            "color": "sky",
            "highlight": true
          }
        ],
        "edges": []
      },
      "effects": [
        {
          "effect": "spawn",
          "target": "energy_budget",
          "label": "= 10.0",
          "color": "sky"
        }
      ],
      "narration": "One sentence, present tense, active voice."
    }
  ]
}

Rules for frames:
- Generate 4-7 frames; each = one atomic action (assignment, comparison, loop step, call, return)
- code_state: only the 1-3 lines most relevant to THIS frame
- narration: one sentence, present tense, active voice — like a documentary narrator. No jargon.

Rules for canvas_scene (drawn as boxes + arrows):
- 1-6 nodes per frame — only what is relevant THIS moment
- node type: "variable" for named variables, "literal" for raw values, "container" for lists/dicts
- node color: "sky"=default variable, "emerald"=result/output, "fuchsia"=boolean/condition,
  "amber"=value changing now, "red"=pruned/failed path, "slate"=unchanged context
- highlight: true on the node being created or modified in this frame
- edges: style "arrow" (assignment/return) or "dashed" (comparison); add a short label like "=", "+", "<", "→"
- parent: set on a node to make it a child of another (tree layout) — use for recursive calls,
  nested structures, call stacks. For flat data flow, use edges instead.

Rules for effects (1-3 per frame — choose what fits the action):
- "spawn"    — a variable is created for the first time
- "pulse"    — a variable's value just changed. REQUIRED fields:
     "target":     variable name (e.g. "count")
     "from_value": the value BEFORE this frame (e.g. "0")
     "to_value":   the value AFTER this frame (e.g. "1")
     "why":        ONE short sentence explaining WHY it changed
                   (e.g. "loop iteration incremented count by 1")
- "flow"     — data moves from one place to another; requires "from" and "to" (use variable labels)
- "highlight"— a condition just evaluated to True
- "burst"    — a function is called or a loop fires
- "fade"     — a variable goes out of scope or a loop ends
- color: match the canvas_scene node color for the same variable
- target: variable label; label: short annotation like "= 10.0", "+= 1", "→ result"

Example pulse showing the full value flow:
  { "effect": "pulse", "target": "count",
    "from_value": "0", "to_value": "1",
    "why": "loop iteration 1: count += 1 increments it by one",
    "color": "amber" }
"""


class DesignerAgent:
    def __init__(self):
        self.llm = get_llm_provider()

    async def generate_animation(
        self,
        topic: str,
        title: str,
        language: str,
        code_snippet: str,
        concept_hook: str = "",
    ) -> list[dict]:
        hook_line = f"\nConcept hook (already written): {concept_hook}" if concept_hook else ""
        prompt = f"""Design a cinematic animation walkthrough for this lesson.

Topic: {topic}
Title: {title}
Language: {language}{hook_line}

Student's code:
```{language}
{code_snippet}
```

Create 4-7 animation frames that walk through this code step by step.
Focus on the {topic} concept. Use the student's actual variable names."""

        try:
            raw = await self.llm.complete(
                messages=[{"role": "user", "content": prompt}],
                system=DESIGNER_SYSTEM,
                max_tokens=4000,
            )
            if not raw or not raw.strip():
                raise ValueError("empty response")
            result = extract_json(raw)
            if isinstance(result, dict) and "animation_frames" in result:
                return result["animation_frames"]
            if isinstance(result, list):
                return result
            raise ValueError(f"unexpected structure: {type(result)}")
        except Exception as exc:
            logger.warning("Designer agent failed for topic=%s: %s", topic, exc)
            return []
