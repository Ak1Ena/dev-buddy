"""
Code Analyzer Agent — detects language, extracts concepts, estimates difficulty
from a user-submitted code snippet.
"""
import re
import logging
from app.services.llm import get_llm_provider
from app.agents.utils import extract_json

logger = logging.getLogger(__name__)

SYSTEM = """You are a code analysis expert for programming education.
Analyze the given code snippet and return ONLY valid JSON — no markdown, no extra text.

Return this exact structure:
{
  "language": "python",
  "difficulty": "beginner",
  "concepts": ["loops", "functions", "variables"],
  "line_count": 12,
  "summary": "One sentence describing what this code does",
  "concept_locations": {
    "loops": "lines 3-7",
    "functions": "line 1"
  }
}

Rules:
- language: one of python, javascript, java, c, cpp, typescript, other
- difficulty: one of beginner, intermediate, advanced
- concepts: list from this set only:
  variables, data_types, operators, conditionals, loops, functions,
  lists, dictionaries, strings, input_output, error_handling, recursion,
  oop_basics, modules, closures, higher_order_functions, async_await,
  list_comprehension, classes, file_io
- concept_locations: map each concept to the line(s) where it appears
- Include only concepts actually present in the code"""

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
