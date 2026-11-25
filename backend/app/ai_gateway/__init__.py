"""AI gateway (M1): the only way agents and routers reach an AI provider.

Module layout:
  types.py        plain data types (requests, events, results)
  errors.py       GatewayError + mapping from SDK/HTTP errors (safe messages)
  providers.py    provider registry and adapter construction (was services/llm/factory.py)
  adapters/       one class per wire format (was services/llm/*_provider.py)
  crypto.py       Fernet encryption of user keys
  credentials.py  per-user credential store
  usage.py        ai_usage log
  json_output.py  JSON extraction + schema validation
  gateway.py      AIGateway, AgentLLM, get_gateway()
"""
from app.ai_gateway.errors import GatewayError
from app.ai_gateway.gateway import AIGateway, AgentLLM, agent_llm, get_gateway
from app.ai_gateway.json_output import JSONOutputError
from app.ai_gateway.types import (
    AIEvent,
    Capabilities,
    ConnectionStatus,
    GenerateRequest,
    GenerateResult,
    ModelInfo,
    Timeouts,
)

__all__ = [
    "AIGateway", "AgentLLM", "agent_llm", "get_gateway", "GatewayError", "JSONOutputError",
    "AIEvent", "Capabilities", "ConnectionStatus", "GenerateRequest", "GenerateResult", "ModelInfo",
    "Timeouts",
]
