import json


def extract_json(text: str) -> dict:
    """Extract the first {...} JSON block from a possibly-noisy LLM response.

    Handles:
    - Reasoning model preamble (chain-of-thought before the JSON)
    - ```json ... ``` fences
    - Trailing text after the closing brace
    """
    text = text.strip()

    # Strip ```json ... ``` fences
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{"):
                text = part
                break

    # Find outermost { ... }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]
    else:
        raise ValueError(
            f"No JSON object found in LLM response.\nRaw (first 400 chars): {text[:400]}"
        )

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Could not parse JSON from LLM response: {exc}\nRaw: {text[:400]}"
        ) from exc
