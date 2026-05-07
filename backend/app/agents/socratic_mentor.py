"""
Socratic Mentor Agent — guides learners through questions rather than giving direct answers.
Uses adaptive hint levels: 0=Socratic question, 1=concept hint, 2=directional hint, 3=worked example.
"""
from typing import AsyncGenerator
import anthropic

from app.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """You are devBuddy, a Socratic programming mentor for beginners. Your role is to GUIDE students to find answers themselves — never give direct code solutions.

## Your Core Philosophy
You teach through the Socratic method: answer questions with questions that lead the student to the answer.
"The goal of education is not to fill a bucket but to light a fire." — W.B. Yeats

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
Example: "Here's how off-by-one errors work with a different problem: [example]. Now look at your code — do you see a similar pattern?"

## Rules
1. NEVER write complete solutions to their specific problem at levels 0-2
2. NEVER say "Here's the fixed code:" unless at level 3 with a DIFFERENT example
3. ALWAYS end your response with a question
4. Keep responses concise — beginners get overwhelmed by walls of text
5. Be warm, encouraging, and patient. Celebrate small wins.
6. If code is provided, analyze it but guide rather than fix

## Response Format
- Use markdown for code blocks
- Keep responses under 200 words at levels 0-1, under 300 at levels 2-3
- Always end with a "?" question"""


class SocraticMentorAgent:
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

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
        context_parts = []
        if lesson_context:
            context_parts.append(f"Current lesson topic: {lesson_context}")
        if skill_level:
            context_parts.append(f"Student skill level: {skill_level}")
        if weak_areas:
            context_parts.append(f"Student weak areas: {', '.join(weak_areas)}")
        context_parts.append(f"Current hint_level: {hint_level}")
        if code_context:
            context_parts.append(f"Student's current code:\n```\n{code_context}\n```")

        system = SYSTEM_PROMPT
        if context_parts:
            system += "\n\n## Current Context\n" + "\n".join(context_parts)

        messages = conversation_history[-20:] + [{"role": "user", "content": user_message}]

        response = await self.client.messages.create(
            model=settings.claude_model,
            max_tokens=600,
            system=system,
            messages=messages,
        )
        return response.content[0].text

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
        context_parts = []
        if lesson_context:
            context_parts.append(f"Current lesson topic: {lesson_context}")
        context_parts.append(f"Current hint_level: {hint_level}")
        if skill_level:
            context_parts.append(f"Student skill level: {skill_level}")
        if weak_areas:
            context_parts.append(f"Student weak areas: {', '.join(weak_areas)}")
        if code_context:
            context_parts.append(f"Student's current code:\n```\n{code_context}\n```")

        system = SYSTEM_PROMPT
        if context_parts:
            system += "\n\n## Current Context\n" + "\n".join(context_parts)

        messages = conversation_history[-20:] + [{"role": "user", "content": user_message}]

        async with self.client.messages.stream(
            model=settings.claude_model,
            max_tokens=600,
            system=system,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text
