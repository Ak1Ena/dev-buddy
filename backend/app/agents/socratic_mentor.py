"""
Socratic Mentor Agent — guides learners through questions rather than giving direct answers.
Hint levels: 0=Socratic question, 1=concept hint, 2=directional hint, 3=worked example.
"""
from typing import AsyncGenerator
from app.services.llm import get_llm_provider

SYSTEM = """You are devBuddy, a Socratic programming mentor for beginners. Your role is to GUIDE students to find answers themselves — never give direct code solutions.

## Your Core Philosophy
You teach through the Socratic method: answer questions with questions that lead the student to the answer.

## Hint Level System
You will be told the current hint_level (0-3). Respond accordingly:

**Level 0 — Socratic Question** (default):
Ask a thought-provoking question that points the student in the right direction.
Example: Student says "my loop is broken" → You ask "What do you expect the loop variable to be on the last iteration? What is it actually?"

**Level 1 — Concept Hint**:
Remind them of the relevant concept without solving it.
Example: "In Python, a while loop continues as long as its condition is True. What does your condition evaluate to when you want it to stop?"

**Level 2 — Directional Hint**:
Point directly at the problem area without giving the solution.
Example: "Look at line 3 — what value does `i` have there compared to what you need it to be?"

**Level 3 — Guided Example**:
Show a similar (but different) worked example, then ask them to apply it.

## Rules
1. NEVER write complete solutions to their specific problem at levels 0-2
2. ALWAYS end your response with a question
3. Keep responses concise — beginners get overwhelmed by walls of text
4. Be warm, encouraging, and patient
5. Keep responses under 200 words at levels 0-1, under 300 at levels 2-3"""


class SocraticMentorAgent:
    def __init__(self):
        self.llm = get_llm_provider()

    def _build_system(
        self,
        lesson_context: str | None,
        code_context: str | None,
        hint_level: int,
        skill_level: str,
        weak_areas: list[str] | None,
    ) -> str:
        parts = [SYSTEM, "\n\n## Current Lesson Context"]
        if lesson_context:
            parts.append(lesson_context)
            parts.append("Use this lesson context to give specific, relevant guidance. Reference the student's actual code and concepts from the lesson.")
        parts.append(f"Current hint_level: {hint_level}")
        if skill_level:
            parts.append(f"Student skill level: {skill_level}")
        if weak_areas:
            parts.append(f"Student weak areas: {', '.join(weak_areas)}")
        if code_context:
            parts.append(f"Student's current code:\n```\n{code_context}\n```")
        return "\n".join(parts)

    async def chat(
        self,
        user_message: str,
        conversation_history: list[dict],
        lesson_context: str | None = None,
        code_context: str | None = None,
        hint_level: int = 0,
        skill_level: str = "beginner",
        weak_areas: list[str] | None = None,
    ) -> str:
        system = self._build_system(lesson_context, code_context, hint_level, skill_level, weak_areas)
        messages = conversation_history[-20:] + [{"role": "user", "content": user_message}]
        return await self.llm.complete(messages=messages, system=system, max_tokens=4000)

    async def stream_chat(
        self,
        user_message: str,
        conversation_history: list[dict],
        lesson_context: str | None = None,
        code_context: str | None = None,
        hint_level: int = 0,
        skill_level: str = "beginner",
        weak_areas: list[str] | None = None,
    ) -> AsyncGenerator[str, None]:
        system = self._build_system(lesson_context, code_context, hint_level, skill_level, weak_areas)
        messages = conversation_history[-20:] + [{"role": "user", "content": user_message}]
        async for chunk in self.llm.stream(messages=messages, system=system, max_tokens=4000):
            yield chunk
