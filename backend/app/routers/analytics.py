"""
Analytics router — exposes FR-05 learning metrics and AC-SGS-006 hint history.
All queries are scoped to the authenticated user.
"""
import logging
from collections import Counter
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.learning import LessonProgress
from app.models.analytics import HintUsageEvent, SkillProgression
from app.schemas.analytics import AnalyticsDashboard, HintUsageEventOut, SkillProgressionOut
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/me", response_model=AnalyticsDashboard)
async def get_my_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return aggregated learning analytics for the current user (FR-05-001–FR-05-005)."""

    # ── lesson progress ──────────────────────────────────────────────────────
    progress_result = await db.execute(
        select(LessonProgress).where(LessonProgress.user_id == current_user.id)
    )
    progress_records = progress_result.scalars().all()

    completed = [p for p in progress_records if p.status == "completed"]
    in_progress = [p for p in progress_records if p.status == "in_progress"]

    # FR-05-001: Hint Dependency Rate — avg hints per completed lesson
    total_hints_from_progress = sum(p.hints_used for p in progress_records)
    hint_dependency_rate = (
        round(total_hints_from_progress / len(completed), 2) if completed else 0.0
    )

    # FR-05-002: Avg completion time (seconds)
    completion_times = [p.time_spent_seconds for p in completed if p.time_spent_seconds > 0]
    avg_completion_time = (
        round(sum(completion_times) / len(completion_times), 1) if completion_times else 0.0
    )

    # FR-05-004: Workshop completion rate — lessons where workshop was attempted
    workshop_attempted = [p for p in progress_records if p.workshop_score is not None]
    workshop_completion_rate = (
        round(len(workshop_attempted) / len(progress_records), 4)
        if progress_records
        else 0.0
    )

    # ── hint usage events ────────────────────────────────────────────────────
    events_result = await db.execute(
        select(HintUsageEvent)
        .where(HintUsageEvent.user_id == current_user.id)
        .order_by(HintUsageEvent.created_at)
    )
    hint_events = events_result.scalars().all()

    # FR-05-005: Misconception frequency — topic → hint event count
    topic_counts = Counter(e.topic for e in hint_events if e.topic)
    misconception_frequency = dict(topic_counts.most_common())

    # AC-SGS-006 breakdown: hint events by level (0–3)
    level_counts = Counter(str(e.hint_level) for e in hint_events)
    hints_by_level = {str(lvl): level_counts.get(str(lvl), 0) for lvl in range(4)}

    # ── skill progression ────────────────────────────────────────────────────
    snapshots_result = await db.execute(
        select(SkillProgression)
        .where(SkillProgression.user_id == current_user.id)
        .order_by(SkillProgression.recorded_at)
    )
    snapshots = snapshots_result.scalars().all()

    # FR-05-003: Concept Retention Score
    # Compare first snapshot's weak areas against the user's current strong areas.
    # Measures how many originally-weak topics the student has since mastered.
    if snapshots and snapshots[0].weak_areas:
        originally_weak = set(snapshots[0].weak_areas)
        currently_strong = set(current_user.strong_areas or [])
        resolved = originally_weak & currently_strong
        concept_retention_score = (
            round(len(resolved) / len(originally_weak), 4) if originally_weak else 1.0
        )
    elif current_user.assessment_score is not None:
        concept_retention_score = round(current_user.assessment_score / 100, 4)
    else:
        concept_retention_score = 0.0

    return AnalyticsDashboard(
        hint_dependency_rate=hint_dependency_rate,
        avg_completion_time_seconds=avg_completion_time,
        concept_retention_score=concept_retention_score,
        workshop_completion_rate=workshop_completion_rate,
        misconception_frequency=misconception_frequency,
        hints_by_level=hints_by_level,
        total_hint_events=len(hint_events),
        lessons_completed=len(completed),
        lessons_in_progress=len(in_progress),
        lessons_total=len(progress_records),
        skill_progression=[SkillProgressionOut.model_validate(s) for s in snapshots],
    )


@router.get("/hint-history", response_model=list[HintUsageEventOut])
async def get_hint_history(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Paginated log of every hint event for the current user (AC-SGS-006)."""
    result = await db.execute(
        select(HintUsageEvent)
        .where(HintUsageEvent.user_id == current_user.id)
        .order_by(HintUsageEvent.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return [HintUsageEventOut.model_validate(e) for e in result.scalars().all()]
