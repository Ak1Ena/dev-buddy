from typing import Annotated, Literal, Union
from pydantic import BaseModel, Field, model_validator
from datetime import datetime
from app.schemas.assessment import CodeAnalysis


# ---------------------------------------------------------------------------
# Viz block — structured concept diagram emitted by the Designer agent.
# Validated post-merge in routers/learning.py; if validation fails the field
# is dropped so the lesson page can still render.
# ---------------------------------------------------------------------------


class CodeRef(BaseModel):
    walkthrough_index: int = Field(ge=0)
    line_start: int = Field(ge=1)
    line_end: int = Field(ge=1)

    model_config = {"extra": "ignore"}

    @model_validator(mode="after")
    def _check_line_range(self) -> "CodeRef":
        if self.line_end < self.line_start:
            raise ValueError(
                f"code_ref.line_end ({self.line_end}) must be >= line_start ({self.line_start})"
            )
        return self


class VizNode(BaseModel):
    id: str = Field(min_length=1)
    label: str = Field(max_length=24)
    summary: str = Field(min_length=1)
    code_ref: CodeRef | None = None
    children: list[str] | None = None

    model_config = {"extra": "ignore"}


class VizEdge(BaseModel):
    source: str = Field(min_length=1)
    target: str = Field(min_length=1)
    label: str | None = Field(default=None, max_length=16)
    code_ref: CodeRef | None = None

    model_config = {"extra": "ignore"}


class VizTableCell(BaseModel):
    value: str
    code_ref: CodeRef | None = None

    model_config = {"extra": "ignore"}


class VizTableRow(BaseModel):
    label: str = Field(min_length=1)
    cells: list[VizTableCell]

    model_config = {"extra": "ignore"}


class VizTree(BaseModel):
    kind: Literal["tree"]
    root_id: str = Field(min_length=1)
    nodes: list[VizNode] = Field(min_length=1)

    model_config = {"extra": "ignore"}


class VizGraph(BaseModel):
    kind: Literal["graph"]
    nodes: list[VizNode] = Field(min_length=1)
    edges: list[VizEdge]

    model_config = {"extra": "ignore"}


class VizTable(BaseModel):
    kind: Literal["table"]
    columns: list[str] = Field(min_length=1)
    rows: list[VizTableRow] = Field(min_length=1)

    model_config = {"extra": "ignore"}


class VizFlow(BaseModel):
    kind: Literal["flow"]
    steps: list[VizNode] = Field(min_length=1)

    model_config = {"extra": "ignore"}


Viz = Annotated[
    Union[VizTree, VizGraph, VizTable, VizFlow],
    Field(discriminator="kind"),
]


class VizEnvelope(BaseModel):
    """Wrapper used purely to drive discriminated-union validation."""

    viz: Viz


class LessonProgressUpdate(BaseModel):
    status: str | None = None
    hints_used: int | None = None
    workshop_score: float | None = None
    time_spent_seconds: int | None = None


class CreateSpaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class LessonResponse(BaseModel):
    id: str
    title: str
    description: str | None
    topic: str
    order_index: int
    estimated_minutes: int
    difficulty: str
    content: dict | None
    progress: dict | None = None
    space_id: str | None = None

    model_config = {"from_attributes": True}


class LessonSurrenderResponse(BaseModel):
    lesson: LessonResponse
    message: str | None = None


class LearningPathResponse(BaseModel):
    id: str
    title: str
    description: str | None
    language: str
    skill_level: str
    total_lessons: int
    completed_lessons: int
    is_active: bool = True
    lessons: list[LessonResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class SpaceSummary(BaseModel):
    id: str
    name: str
    is_active: bool
    created_at: datetime
    path: LearningPathResponse | None = None

    model_config = {"from_attributes": True}


class InstantDiscoveryRequest(BaseModel):
    code_snippet: str
    language: str | None = None


class InstantDiscoveryResponse(BaseModel):
    space_id: str
    session_id: str
    analysis: CodeAnalysis
