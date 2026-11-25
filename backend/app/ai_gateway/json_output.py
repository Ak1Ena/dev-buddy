"""Structured output: tolerant JSON extraction + schema validation.

Moved from app/agents/utils.py in M1 (logic unchanged) so the gateway's
complete_json() and the agents share one parser. app/agents/utils.py
re-exports extract_json for the agents that still parse themselves.
"""
import json
import re

from pydantic import BaseModel, ValidationError


def extract_json(text: str) -> dict | list:
    """Extract JSON from a possibly-noisy LLM response.

    Handles:
    - Reasoning model preamble before the JSON
    - ```json ... ``` fences
    - Model outputting a bare list / multiple objects without outer wrapper
    - Trailing text after the last closing brace
    """
    text = text.strip()

    # Strip ```json ... ``` fences
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{") or part.startswith("["):
                text = part
                break

    # Try direct parse first (happy path — model returned clean JSON)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Find the first { or [ and match its closing counterpart
    first_brace = text.find("{")
    first_bracket = text.find("[")

    if first_bracket != -1 and (first_brace == -1 or first_bracket < first_brace):
        # Looks like a JSON array
        end = text.rfind("]")
        if end != -1:
            candidate = text[first_bracket : end + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

    if first_brace != -1:
        # Find matching closing brace using a depth counter so we don't
        # overshoot into the next object in "Extra data" situations
        depth = 0
        in_string = False
        escape_next = False
        end = -1
        for i, ch in enumerate(text[first_brace:], start=first_brace):
            if escape_next:
                escape_next = False
                continue
            if ch == "\\" and in_string:
                escape_next = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i
                    break

        if end != -1:
            candidate = text[first_brace : end + 1]
            try:
                parsed = json.loads(candidate)
                # If there's more JSON after this object, collect all siblings
                remainder = text[end + 1 :].strip().lstrip(",").strip()
                if remainder.startswith("{"):
                    all_objects = _collect_json_objects(text[first_brace:])
                    if len(all_objects) > 1:
                        return all_objects
                return parsed
            except json.JSONDecodeError:
                pass

        # Last resort: model emitted multiple sibling objects — wrap as array
        all_objects = _collect_json_objects(text[first_brace:])
        if all_objects:
            return all_objects  # caller handles list vs dict

    # Last resort: try to fix truncated JSON by closing unclosed strings / braces / brackets
    if first_brace != -1:
        fragment = text[first_brace:]
        stack: list[str] = []
        in_str = False
        escaped = False
        for ch in fragment:
            if escaped:
                escaped = False
                continue
            if ch == "\\" and in_str:
                escaped = True
                continue
            if ch == '"':
                in_str = not in_str
                continue
            if in_str:
                continue
            if ch in "{[":
                stack.append(ch)
            elif ch == "}":
                if stack and stack[-1] == "{":
                    stack.pop()
            elif ch == "]":
                if stack and stack[-1] == "[":
                    stack.pop()
        if in_str or stack:
            fix = fragment
            if in_str:
                fix += '"'
            closers = {"{": "}", "[": "]"}
            for opener in reversed(stack):
                fix += closers[opener]
            try:
                return json.loads(fix)
            except (json.JSONDecodeError, ValueError):
                pass

    raise ValueError(
        f"No valid JSON found in LLM response.\nRaw (first 600 chars): {text[:600]}"
    )


def _collect_json_objects(text: str) -> list[dict]:
    """Parse a stream of sibling JSON objects like `{...}, {...}, ...` into a list."""
    objects = []
    pos = 0
    while pos < len(text):
        start = text.find("{", pos)
        if start == -1:
            break
        depth = 0
        in_string = False
        escape_next = False
        end = -1
        for i, ch in enumerate(text[start:], start=start):
            if escape_next:
                escape_next = False
                continue
            if ch == "\\" and in_string:
                escape_next = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        if end == -1:
            break
        try:
            obj = json.loads(text[start : end + 1])
            objects.append(obj)
        except json.JSONDecodeError:
            pass
        pos = end + 1
    return objects


class JSONOutputError(ValueError):
    """The model's reply could not be parsed or did not match the schema.

    raw_text holds the last reply so a caller can salvage part of it. It is never
    part of str(exc), so logging the error does not log the reply.
    """

    raw_text: str = ""


def parse_into(text: str, schema: type[BaseModel]) -> BaseModel:
    """Extract JSON from a model reply and validate it against `schema`."""
    try:
        data = extract_json(text)
    except ValueError as exc:
        raise JSONOutputError("Reply contained no valid JSON.") from exc
    try:
        return schema.model_validate(data)
    except ValidationError as exc:
        # Keep only field paths and messages; never echo the raw reply.
        problems = "; ".join(
            f"{'.'.join(str(p) for p in err['loc']) or '<root>'}: {err['msg']}"
            for err in exc.errors()[:5]
        )
        raise JSONOutputError(f"JSON did not match the schema: {problems}") from exc


def schema_instruction(schema: type[BaseModel]) -> str:
    """System-prompt suffix telling the model exactly what to return."""
    return (
        "\n\nReturn ONLY a JSON value matching this JSON Schema. "
        "No prose, no markdown fences.\n"
        f"{json.dumps(schema.model_json_schema(), separators=(',', ':'))}"
    )
