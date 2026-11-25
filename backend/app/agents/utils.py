"""Kept so agents can keep `from app.agents.utils import extract_json`.

The parser now lives in app/ai_gateway/json_output.py (M1 step 4).
"""
from app.ai_gateway.json_output import extract_json

__all__ = ["extract_json"]
