import json
import re


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
