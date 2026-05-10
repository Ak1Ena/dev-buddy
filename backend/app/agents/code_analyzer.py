"""
Code Analyzer Agent — detects language, extracts concepts, estimates difficulty,
and detects programming misconceptions from a user-submitted code snippet.
"""
import asyncio
import re
import logging
from app.services.llm import get_llm_provider
from app.agents.utils import extract_json

logger = logging.getLogger(__name__)

SYSTEM = """You are a polyglot code analysis expert.
Analyze the given code snippet from ANY programming language and return ONLY valid JSON.
Identify universal programming patterns (Control Flow, Data Transformation, Memory Management) 
regardless of the specific syntax.

Return this exact structure:
{
  "language": "detected_language",
  "difficulty": "beginner/intermediate/advanced",
  "concepts": ["universal_concept_1", "universal_concept_2"],
  "line_count": 12,
  "summary": "One sentence describing the logic",
  "concept_locations": {
    "concept": "lines X-Y"
  }
}

Rules:
- Handle any language: Python, JS, C++, Rust, Go, SQL, Swift, or even assembly.
- Focus on the LOGIC, not just the syntax.
- Include only concepts actually present in the code."""

# ── deterministic fallback ────────────────────────────────────────────────────

_LANG_HINTS = {
    "python":     [r"\bdef \w+", r"\bimport \w+", r"\belif\b", r"\bprint\s*\(", r":\s*$"],
    "javascript": [r"\bfunction\b", r"\bconst\b|\blet\b|\bvar\b", r"=>\s*{", r"console\.log"],
    "typescript": [r":\s*(string|number|boolean|void)\b", r"\binterface\b", r"\btype\b"],
    "java":       [r"\bpublic\s+class\b", r"\bSystem\.out\b", r"\bvoid\b.*\("],
    "cpp":        [r"#include\s*<", r"\bcout\b", r"\bstd::\b"],
    "c":          [r"#include\s*<stdio", r"\bprintf\s*\(", r"\bint\s+main\s*\("],
}

_CONCEPT_PATTERNS = {
    "functions":             r"\bdef \w+|\bfunction\b|=>\s*{|\bvoid\b.*\(",
    "classes":               r"\bclass\b",
    "loops":                 r"\bfor\b|\bwhile\b",
    "conditionals":          r"\bif\b|\belif\b|\belse\b|\bswitch\b",
    "recursion":             r"def (\w+).*\n(?:.*\n)*?.*\b\1\s*\(",
    "error_handling":        r"\btry\b|\bexcept\b|\bcatch\b|\bfinally\b",
    "lists":                 r"\[.*\]|\bappend\b|\bpush\b",
    "dictionaries":          r"\{.*:.*\}|\bdict\b|\bdefaultdict\b",
    "modules":               r"\bimport\b|\bfrom\b.*\bimport\b|\brequire\b",
    "higher_order_functions":r"\bmap\b|\bfilter\b|\breduce\b|\bsorted\b.*key",
    "list_comprehension":    r"\[.+\bfor\b.+\bin\b",
    "async_await":           r"\basync\b|\bawait\b",
    "oop_basics":            r"\bself\b|\bthis\b|\b__init__\b",
    "variables":             r"\w+\s*=\s*\S",
    "operators":             r"[+\-*/%]=|==|!=|<=|>=",
    "strings":               r'["\'].*["\']|\bf["\']',
    "input_output":          r"\bprint\s*\(|\binput\s*\(|\bconsole\b|\bscanf\b",
    "data_types":            r"\bint\b|\bstr\b|\bfloat\b|\bbool\b|\blist\b|\btuple\b",
    "file_io":               r"\bopen\s*\(|\bfs\.\b|\breadFile\b|\bwriteFile\b",
}


MISCONCEPTION_SYSTEM = """You are a programming error analysis expert for beginner education.
Analyze the given code for common programming misconceptions and error patterns.
Return ONLY valid JSON — no markdown, no extra text.

Return this exact structure (array of misconceptions, empty array if none found):
[
  {
    "error_category": "logic_error",
    "misconception_type": "off_by_one",
    "confidence_score": 0.85,
    "description": "Brief explanation of the specific misconception in this code",
    "location": "line 5"
  }
]

error_category must be one of:
  logic_error, scope_error, type_error, syntax_misunderstanding, algorithm_error, naming_error

Common misconception_type values:
  off_by_one, infinite_loop, wrong_condition, incorrect_operator,
  variable_shadowing, undefined_variable, wrong_scope,
  type_mismatch, implicit_conversion, mutable_default_argument,
  assignment_vs_equality, identity_vs_equality, mutation_vs_reassignment,
  wrong_base_case, missing_termination, incorrect_iteration_order,
  missing_return, unused_variable, unreachable_code

Rules:
- Return [] if no misconceptions are found
- confidence_score: 0.0–1.0 (certainty this is a real mistake, not style)
- Only include items with confidence_score >= 0.5
- Focus on beginner-level errors, not style or optimization
- Maximum 5 misconceptions"""

# ── static misconception detection ───────────────────────────────────────────

_MISCONCEPTION_STATIC_CHECKS = [
    {
        "pattern": r"range\s*\(\s*len\s*\([^)]+\)\s*[+-]\s*1\s*\)",
        "error_category": "logic_error",
        "misconception_type": "off_by_one",
        "description": "Explicit ±1 adjustment inside range(len(...)) is a common off-by-one indicator",
        "confidence_score": 0.70,
    },
    {
        "pattern": r"\bwhile\s+True\b",
        "error_category": "logic_error",
        "misconception_type": "potential_infinite_loop",
        "description": "while True loop detected — verify that a reachable break or return exists",
        "confidence_score": 0.55,
    },
    {
        "pattern": r"\bdef\s+\w+\s*\([^)]*=\s*[\[\{]",
        "error_category": "scope_error",
        "misconception_type": "mutable_default_argument",
        "description": "Mutable default argument (list or dict) is shared across every call to this function",
        "confidence_score": 0.85,
    },
    {
        "pattern": r"\b\w+\s+is\s+['\"]",
        "error_category": "type_error",
        "misconception_type": "identity_vs_equality",
        "description": "Using 'is' to compare strings tests object identity, not value — use '==' instead",
        "confidence_score": 0.80,
    },
    {
        "pattern": r"for\s+(\w+)\s+in\s+\S+.*:[\s\S]*?for\s+\1\s+in",
        "error_category": "scope_error",
        "misconception_type": "variable_shadowing",
        "description": "Outer loop variable reused in a nested loop — inner loop silently overwrites it",
        "confidence_score": 0.75,
    },
    {
        "pattern": r"\bif\s+\w+\s*=(?!=)",
        "error_category": "syntax_misunderstanding",
        "misconception_type": "assignment_vs_equality",
        "description": "Single '=' inside a condition performs assignment, not comparison — use '=='",
        "confidence_score": 0.90,
    },
    {
        "pattern": r"\breturn\b[^\n#]*\n[ \t]+[^\s#]",
        "error_category": "logic_error",
        "misconception_type": "unreachable_code",
        "description": "Code appears after a return statement in the same block and will never execute",
        "confidence_score": 0.70,
    },
    {
        "pattern": r"\b(\w+)\s*=\s*\1\s*\+\s*\1\b",
        "error_category": "logic_error",
        "misconception_type": "incorrect_accumulation",
        "description": "Variable doubled by adding itself to itself — likely intended '+=' with a different operand",
        "confidence_score": 0.65,
    },
]


def _static_detect_misconceptions(code: str) -> list[dict]:
    results: list[dict] = []
    for check in _MISCONCEPTION_STATIC_CHECKS:
        match = re.search(check["pattern"], code, re.MULTILINE)
        if match:
            ln = code[: match.start()].count("\n") + 1
            results.append({
                "error_category": check["error_category"],
                "misconception_type": check["misconception_type"],
                "confidence_score": check["confidence_score"],
                "description": check["description"],
                "location": f"line {ln}",
            })
    return results


def _static_analyze(code: str) -> dict:
    lines = code.splitlines()
    line_count = len(lines)

    # Detect language
    language = "other"
    for lang, patterns in _LANG_HINTS.items():
        if any(re.search(p, code, re.MULTILINE) for p in patterns):
            language = lang
            break

    # Extract concepts
    concepts = []
    concept_locations: dict[str, str] = {}
    for concept, pattern in _CONCEPT_PATTERNS.items():
        matches = list(re.finditer(pattern, code, re.MULTILINE))
        if matches:
            concepts.append(concept)
            nums = []
            for m in matches:
                ln = code[: m.start()].count("\n") + 1
                nums.append(ln)
            if len(nums) == 1:
                concept_locations[concept] = f"line {nums[0]}"
            else:
                concept_locations[concept] = f"lines {nums[0]}-{nums[-1]}"

    # Difficulty
    advanced = {"recursion", "higher_order_functions", "async_await", "closures", "oop_basics"}
    intermediate = {"error_handling", "list_comprehension", "classes", "dictionaries"}
    if advanced & set(concepts):
        difficulty = "advanced"
    elif intermediate & set(concepts):
        difficulty = "intermediate"
    else:
        difficulty = "beginner"

    # Brief summary from first non-empty comment or docstring
    summary = f"{language.title()} code with {len(concepts)} concepts: {', '.join(concepts[:4])}."
    for line in lines:
        stripped = line.strip().lstrip("#").lstrip('"').lstrip("'").strip()
        if 10 < len(stripped) < 120 and not stripped.startswith("*"):
            summary = stripped.rstrip(".")
            break

    return {
        "language": language,
        "difficulty": difficulty,
        "concepts": concepts or ["variables"],
        "line_count": line_count,
        "summary": summary,
        "concept_locations": concept_locations,
    }


# ── agent ─────────────────────────────────────────────────────────────────────

class CodeAnalyzerAgent:
    def __init__(self):
        self.llm = get_llm_provider()

    async def analyze(self, code_snippet: str) -> dict:
        try:
            raw = await self.llm.complete(
                messages=[{"role": "user", "content": f"Analyze this code:\n```\n{code_snippet}\n```"}],
                system=SYSTEM,
                max_tokens=8000,
            )
            logger.debug("CodeAnalyzer raw LLM response: %r", raw[:500] if raw else "<empty>")
            if raw and raw.strip():
                result = extract_json(raw)
                if result.get("language") and result.get("concepts"):
                    return result
        except Exception as exc:
            logger.warning("LLM code analysis failed, using static fallback: %s", exc)

        logger.info("Using static code analysis fallback")
        return _static_analyze(code_snippet)

    async def detect_misconceptions(self, code_snippet: str) -> list[dict]:
        """Detect programming misconceptions in the given code (AC-GAP-001).

        Returns a list of dicts with keys: error_category, misconception_type,
        confidence_score, description, location.  Enforces the 3-second SLA
        from AC-GAP-001 by falling back to static regex analysis on timeout.
        """
        try:
            raw = await asyncio.wait_for(
                self.llm.complete(
                    messages=[{
                        "role": "user",
                        "content": f"Detect misconceptions in this code:\n```\n{code_snippet}\n```",
                    }],
                    system=MISCONCEPTION_SYSTEM,
                    max_tokens=1500,
                ),
                timeout=3.0,
            )
            logger.debug("MisconceptionDetector raw LLM response: %r", raw[:300] if raw else "<empty>")
            if raw and raw.strip():
                result = extract_json(raw)
                if isinstance(result, list):
                    return result
                if isinstance(result, dict) and "misconceptions" in result:
                    return result["misconceptions"]
        except asyncio.TimeoutError:
            logger.warning("Misconception detection exceeded 3 s SLA — using static fallback")
        except Exception as exc:
            logger.warning("LLM misconception detection failed, using static fallback: %s", exc)

        return _static_detect_misconceptions(code_snippet)
