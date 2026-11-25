"""Pydantic schemas for the JSON each agent asks the model for (roadmap M1 step 4).

They live next to the agents, not in app/schemas (HTTP shapes) or the gateway
(provider-agnostic), because each one mirrors one agent prompt.

Rules for every schema here:
- extra="allow" and agents dump with exclude_unset=True, so the dict a route
  gets has the same keys the model sent: the frontend's shapes do not change.
- Only the fields the backend actually reads are required (for example the
  learning router indexes lesson["title"], ["topic"], ["order_index"]). A reply
  missing them fails validation, and the gateway retries once with the reason.
- "before" validators accept the loose shapes the agents already tolerated
  (a bare list instead of the wrapper object, and so on).
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, RootModel, model_validator


class _Open(BaseModel):
    model_config = ConfigDict(extra="allow")

    def to_dict(self) -> dict[str, Any]:
        return self.model_dump(exclude_unset=True)


def _wrap_list(data: Any, key: str) -> Any:
    return {key: data} if isinstance(data, list) else data


# ── code_analyzer ────────────────────────────────────────────────────────────

class CodeAnalysis(_Open):
    is_code: bool = True
    language: str = ""
    concepts: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _code_needs_language_and_concepts(self) -> "CodeAnalysis":
        if self.is_code and not (self.language and self.concepts):
            raise ValueError("language and a non-empty concepts list are required when is_code is true")
        return self


class Misconceptions(RootModel[list[dict[str, Any]]]):
    """A JSON array; {"misconceptions": [...]} is accepted too. Items are filtered
    by code_analyzer._valid_misconceptions, as before."""

    @model_validator(mode="before")
    @classmethod
    def _unwrap(cls, data: Any) -> Any:
        if isinstance(data, dict) and isinstance(data.get("misconceptions"), list):
            return data["misconceptions"]
        return data


# ── assessment_generator ─────────────────────────────────────────────────────

class QuestionSet(_Open):
    """Only the envelope is checked; assessment_generator._normalize_questions still
    drops bad items one by one, so one broken question does not cost the other nine."""

    questions: list[dict[str, Any]]

    @model_validator(mode="before")
    @classmethod
    def _accept_bare_list(cls, data: Any) -> Any:
        return _wrap_list(data, "questions")


# ── planner ──────────────────────────────────────────────────────────────────

class PlannedLesson(_Open):
    order_index: int
    title: str
    topic: str


class LearningPathPlan(_Open):
    """generate_learning_path and generate_topic_path. A bare list of lessons, or a
    single lesson object, is wrapped as before; the agent adds the default title."""

    lessons: list[PlannedLesson] = Field(min_length=1)

    @model_validator(mode="before")
    @classmethod
    def _accept_loose_shapes(cls, data: Any) -> Any:
        if isinstance(data, dict) and "lessons" not in data and isinstance(data.get("order_index"), int):
            return {"lessons": [data]}
        return _wrap_list(data, "lessons")


_CONTENT_KEYS = ("concept_hook", "key_concepts", "explanation", "code_walkthrough")


class LessonContent(_Open):
    """Sibling objects come back from the JSON parser as a list: pick the one that looks
    like lesson content, else the first object (as before)."""

    @model_validator(mode="before")
    @classmethod
    def _pick_from_list(cls, data: Any) -> Any:
        if isinstance(data, list):
            dicts = [d for d in data if isinstance(d, dict)]
            for item in dicts:
                if any(k in item for k in _CONTENT_KEYS):
                    return item
            return dicts[0] if dicts else data
        return data

    @model_validator(mode="after")
    def _has_content(self) -> "LessonContent":
        if not any(k in (self.model_extra or {}) for k in _CONTENT_KEYS):
            raise ValueError(f"needs at least one of: {', '.join(_CONTENT_KEYS)}")
        return self


# ── designer ─────────────────────────────────────────────────────────────────

_ANIMATION_KEYS = ("animation_frames", "viz", "deep_dive")


class AnimationSpec(_Open):
    @model_validator(mode="before")
    @classmethod
    def _accept_bare_frames(cls, data: Any) -> Any:
        return _wrap_list(data, "animation_frames")

    @model_validator(mode="after")
    def _has_something_to_show(self) -> "AnimationSpec":
        if not any(k in (self.model_extra or {}) for k in _ANIMATION_KEYS):
            raise ValueError(f"needs at least one of: {', '.join(_ANIMATION_KEYS)}")
        return self


# ── choreographer ────────────────────────────────────────────────────────────

class Scene(_Open):
    timeline: list[dict[str, Any]]


# ── lesson_suggester ─────────────────────────────────────────────────────────

class LessonSuggestion(_Open):
    should_create: bool
    topic: str | None = None
    title: str | None = None

    @model_validator(mode="after")
    def _lesson_needs_topic_and_title(self) -> "LessonSuggestion":
        # chat.py reads spec["topic"] and spec["title"] when a lesson is created.
        if self.should_create and not (self.topic and self.title):
            raise ValueError("topic and title are required when should_create is true")
        return self
