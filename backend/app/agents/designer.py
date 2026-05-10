"""
Designer Agent — generates cinematic animation frames with canvas scenes and
particle effects for a lesson. Separated from the Planner so visual design has
its own model, prompt, and token budget.
"""
import logging
from app.services.llm import get_llm_provider
from app.agents.utils import extract_json

logger = logging.getLogger(__name__)

DESIGNER_SYSTEM = """You are a learning experience architect for self-taught developers.
Your goal is to build an "Active Discovery" walkthrough. Instead of just explaining 
how code works, you must create a journey where the user is a participant.

Return ONLY valid JSON — no markdown, no extra text:
{
  "deep_dive": {
    "title": "Architectural Insight",
    "content": "2-3 paragraphs of deep technical explanation focusing on 'The Why', patterns, and mental models. Use Markdown.",
    "concepts": ["Pattern A", "Concept B"]
  },
  "animation_frames": [
    {
      "frame": 1,
      "title": "The Decision Point",
      "code_state": "if count > 5:",
      "is_checkpoint": true,
      "checkpoint_question": "Based on the current state, will we enter this block?",
      "canvas_scene": {
        "nodes": [
          { "id": "q", "type": "decision", "label": "count > 5?", "color": "fuchsia", "highlight": true }
        ],
        "edges": []
      },
      "narration": "Before we move forward, take a look at the condition. What do you think happens next?"
    }
  ]
}

## Philosophy: Active Discovery
1. **Never Spoils:** Do not explain the outcome of a decision in the frame where it first appears.
2. **Checkpoints:** Use `is_checkpoint: true` and a `checkpoint_question` at every critical logic branch (if-statements, loop conditions, function returns).
3. **Graph Traversal:** Use the Logic Map to show the execution path. Highlight the node where the user must make a prediction.

Rules for frames:
- 4-7 frames total.
- At least 2 frames MUST be `is_checkpoint: true`.
- narration: Should be a "Socratic prompt" for checkpoints, and a "Discovery confirmation" for non-checkpoints.

Node Palette:
- Decision Nodes (fuchsia): logic branches.
- Action Nodes (sky): data updates.
- Outcome Nodes (emerald): final results.

## The Deep Dive (Technical Depth)
The `deep_dive` section is where you provide the "Senior-level" context. 
- Do not explain syntax. 
- Explain memory management, execution order, pattern benefits, or common architectural traps. 
- Use it to bridge the gap between "beginner" and "expert."
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
    ) -> dict:
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
            if isinstance(result, dict):
                return result
            if isinstance(result, list):
                return {"animation_frames": result}
            raise ValueError(f"unexpected structure: {type(result)}")
        except Exception as exc:
            logger.warning("Designer agent failed for topic=%s: %s", topic, exc)
            return {"animation_frames": [], "deep_dive": None}
