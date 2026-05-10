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
Your goal is to build an "Active Discovery" walkthrough where each frame SHOWS the
data evolving — not narrates it. Imagine a debugger's variable inspector that
visually updates step by step.

Return ONLY valid JSON — no markdown, no extra text:
{
  "deep_dive": {
    "title": "Architectural Insights",
    "cards": [
      {
        "title": "Short Title",
        "content": "Bite-sized technical insight (1-2 sentences).",
        "icon": "brain|zap|shield|database|cpu",
        "related_nodes": ["data-view-id-or-node-id"]
      }
    ]
  },
  "animation_frames": [
    {
      "frame": 1,
      "title": "Initialize the accumulator",
      "code_state": "total = 0\\nnumbers = [1, 2, 3, 4, 5]",
      "is_checkpoint": false,
      "data_views": [
        {
          "kind": "vars",
          "label": "Variables",
          "rows": [
            { "name": "total", "value": "0", "status": "updated" }
          ]
        },
        {
          "kind": "array",
          "label": "numbers",
          "cells": [
            { "key": 0, "value": "1", "status": "filled" },
            { "key": 1, "value": "2", "status": "filled" },
            { "key": 2, "value": "3", "status": "filled" },
            { "key": 3, "value": "4", "status": "filled" },
            { "key": 4, "value": "5", "status": "filled" }
          ],
          "cursors": [ { "key": 0, "label": "i=0", "color": "fuchsia" } ]
        }
      ],
      "narration": "We start with total at 0 and the cursor at index 0."
    },
    {
      "frame": 2,
      "title": "Read numbers[0] and add it",
      "code_state": "total += numbers[0]   # total = 0 + 1",
      "is_checkpoint": true,
      "checkpoint_question": "After this line runs, what will total become?",
      "data_views": [
        {
          "kind": "vars",
          "label": "Variables",
          "rows": [
            { "name": "total", "value": "0", "status": "active", "note": "about to update" }
          ]
        },
        {
          "kind": "array",
          "label": "numbers",
          "cells": [
            { "key": 0, "value": "1", "status": "active" },
            { "key": 1, "value": "2", "status": "filled" },
            { "key": 2, "value": "3", "status": "filled" },
            { "key": 3, "value": "4", "status": "filled" },
            { "key": 4, "value": "5", "status": "filled" }
          ],
          "cursors": [ { "key": 0, "label": "i=0", "color": "fuchsia" } ]
        }
      ],
      "narration": "We're about to read numbers[0] and add it into total. Predict the new value."
    }
  ]
}

## Philosophy: Show, don't tell
1. **Every frame is a snapshot of state.** Use `data_views` to render the actual variables, arrays, objects, stacks or queues at this moment in time. Each subsequent frame should differ by exactly the change the code at that step would make — no more, no less.
2. **Mark what changed.** On a cell or row that just changed, set `status: "updated"` (or `"active"` if it's about to change). On the cell currently being inspected, use `status: "active"`. Use `"compare"` for two cells being compared, `"result"` for the final answer. Cells that haven't been written yet should be `status: "empty"` with `value: null`.
3. **Cursors track loop variables.** For a loop, include a cursor in `data_views` of kind `array` showing where `i`, `j`, `left`, `right` etc. point. Cursors move from frame to frame.
4. **Never spoils:** On checkpoints, do NOT pre-update the value the student is supposed to predict — keep the cell `active` (about to change) but show the OLD value.

## data_views — pick the right shape

| kind     | when to use                                    | required fields                                          |
|----------|------------------------------------------------|----------------------------------------------------------|
| `vars`   | scalars: counters, accumulators, flags         | `rows: [{ name, value, status?, note? }]`                |
| `array`  | lists, arrays, strings indexed by position     | `cells: [{ key, value, status? }]`, optional `cursors`   |
| `object` | dicts, hash maps, key→value pairs              | `rows: [{ name, value, status?, note? }]`                |
| `stack`  | LIFO: function call stack, undo history        | `items: [{ value, status? }]` (last item = top)          |
| `queue`  | FIFO: BFS frontier, task queue                 | `items: [{ value, status? }]` (first item = front)       |

`status` values: `"filled"` (default value), `"empty"` (placeholder, value=null), `"active"` (about to change / being read), `"updated"` (just changed this frame), `"compare"` (being compared), `"result"` (final answer), `"removed"` (popped/dequeued).

Cursor `color`: `"sky"`, `"emerald"`, `"fuchsia"` (default), `"amber"`, `"red"`, `"slate"`.

## Rules for frames
- **4-7 frames total.** Each frame should advance the data state by ONE meaningful step.
- **At least 2 frames MUST have `is_checkpoint: true`** with a Socratic `checkpoint_question` that asks the user to predict the next state.
- **`code_state`**: 1-3 lines of the actual code being executed at this step (with the relevant line highlighted in a comment if helpful).
- **`narration`**: 1 sentence. Point out what just happened or what's about to happen — never restate what the diagram already shows.
- **State continuity**: each frame's `data_views` must include the SAME keys/structures as the previous frame so transitions look smooth. Don't drop or rename a variable mid-walkthrough.

## When to use canvas_scene instead
For pure control-flow lessons (an `if/elif/else` cascade with no data structure to track), you may emit `canvas_scene` with decision/action/outcome nodes. But if there is ANY data structure (variable, list, dict, string), prefer `data_views`.

## The Deep Dive: Mastery Cards
- Create 3-5 focused cards.
- **Strict Prohibition:** Never explain syntax. Focus on "The Why": memory management, architectural patterns, performance trade-offs, or safety.
- Icons: `brain` (mental models), `zap` (performance), `shield` (safety), `database` (state), `cpu` (low-level).
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
