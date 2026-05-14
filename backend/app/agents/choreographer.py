"""
Choreographer Agent — generates a SceneJSON from code + AST.
"""
import asyncio
import logging
from app.services.llm import get_llm_provider
from app.agents.utils import extract_json
from app.core.ast_analyzer import ASTAnalyzer

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a Cinematic Logic Choreographer.
Your job is to transform a piece of code into a 'Scene JSON' for an animation engine.

Rules for Choreography:
1. Every major logic step (assignment, loop check, function call) should have a 'code_highlight' entry.
2. Use 'box' to represent variables/memory slots.
3. Use 'particle' for data movement (e.g. from one box to another).
4. Use 'pulse' to draw attention to a node when its value changes or a decision is made.
5. Use 'gate' for interactive questions (Socratic pauses) at critical decision points.
6. Timing: All 'start' and 'duration' values are in seconds. Total duration should be between 3s and 15s.
7. Coordinates: Use a 1000x1000 coordinate system (0-1000 for both X and Y).

Output ONLY the following JSON structure:
{
  "version": "1.0",
  "metadata": {
    "title": "Scene Title",
    "description": "Brief description",
    "totalDuration": float
  },
  "timeline": [
    {
      "id": "unique-id",
      "type": "box" | "particle" | "pulse" | "gate" | "code_highlight",
      "start": float,
      "duration": float,
      "props": { ... }
    }
  ]
}

Primitive Prop Reference:
- box: { "label": "var_name", "value": "10", "pos": [x, y], "isActive": bool }
- particle: { "fromPos": [x1, y1], "toPos": [x2, y2], "color": "fuchsia|sky|emerald|amber" }
- pulse: { "x": x, "y": y, "radius": 60, "color": "#hex" }
- gate: { "x": 500, "y": 500, "question": "Question?", "options": ["A", "B"], "correctAnswer": "A", "feedback": "Why A is correct" }
- code_highlight: { "line_start": 1, "line_end": 1, "walkthrough_index": 0 }

Layout Strategy:
- Variables (boxes) usually live on the left or top.
- Execution flow moves center or right.
- Decision points (gates) should be centered.
"""

class ChoreographerAgent:
    def __init__(self):
        self.llm = get_llm_provider()
        self.ast_analyzer = ASTAnalyzer()

    async def choreograph(self, code: str) -> dict:
        ast_summary = self.ast_analyzer.analyze(code)
        
        prompt = (
            f"Source Code:\n```python\n{code}\n```\n\n"
            f"Structural Analysis:\n{ast_summary}\n\n"
            "Choreograph this logic into a cinematic sequence. "
            "Ensure 'code_highlight' is synced with the visualization. "
            "Insert at least one 'gate' if the logic has a decision point."
        )
        
        try:
            raw = await self.llm.complete(
                messages=[{"role": "user", "content": prompt}],
                system=SYSTEM_PROMPT,
                max_tokens=4000,
            )
            return extract_json(raw)
        except Exception as e:
            logger.error(f"Choreographer failed: {e}")
            return {
                "version": "1.0",
                "metadata": {"title": "Error", "totalDuration": 0},
                "timeline": []
            }
