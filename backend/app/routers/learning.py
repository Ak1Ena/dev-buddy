import asyncio
import logging
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.database import get_db, AsyncSessionLocal
from app.models.user import User
from app.models.assessment import AssessmentSession
from app.models.learning import LearningSpace, LearningPath, Lesson, LessonProgress
from app.schemas.learning import (
    LearningPathResponse,
    LessonResponse,
    LessonProgressUpdate,
    CreateSpaceRequest,
    SpaceSummary,
)
from app.agents.planner import PlannerAgent
from app.agents.designer import DesignerAgent
from app.utils.auth import get_current_user

router = APIRouter(prefix="/learning", tags=["learning"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _build_lesson_content(
    topic: str,
    title: str,
    language: str,
    skill_level: str,
    source_code: str,
    weak_areas: list[str],
) -> dict:
    """Call Planner (narrative) + Designer (animation) in parallel and merge."""
    planner = PlannerAgent()
    designer = DesignerAgent()

    content, frames = await asyncio.gather(
        planner.generate_lesson_content(
            topic=topic,
            title=title,
            language=language,
            skill_level=skill_level,
            code_snippet=source_code,
            weak_areas=weak_areas,
        ),
        designer.generate_animation(
            topic=topic,
            title=title,
            language=language,
            code_snippet=source_code,
        ),
    )

    if frames:
        content["animation_frames"] = frames
    return content


async def _prefill_lesson_content(
    path_id: str,
    language: str,
    skill_level: str,
    source_code: str,
    weak_areas: list[str],
):
    """Background task: generate content for every lesson in a path, 3 at a time."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Lesson)
            .where(Lesson.learning_path_id == path_id, Lesson.content.is_(None))
            .order_by(Lesson.order_index)
        )
        lessons = result.scalars().all()

    if not lessons:
        return

    sem = asyncio.Semaphore(3)

    async def generate_one(lesson_id: str, topic: str, title: str, order: int):
        async with sem:
            try:
                content = await _build_lesson_content(
                    topic=topic,
                    title=title,
                    language=language,
                    skill_level=skill_level,
                    source_code=source_code,
                    weak_areas=weak_areas,
                )
                async with AsyncSessionLocal() as session:
                    await session.execute(
                        update(Lesson).where(Lesson.id == lesson_id).values(content=content)
                    )
                    await session.commit()
                logger.info("Pre-generated lesson %s (%s)", order, title)
            except Exception as exc:
                logger.warning("Failed to pre-generate lesson %s: %s", lesson_id, exc)

    await asyncio.gather(*[
        generate_one(str(l.id), l.topic, l.title, l.order_index)
        for l in lessons
    ])


async def _get_active_space(user_id: str, db: AsyncSession) -> LearningSpace | None:
    result = await db.execute(
        select(LearningSpace).where(
            LearningSpace.user_id == user_id,
            LearningSpace.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def _deactivate_all_spaces(user_id: str, db: AsyncSession):
    result = await db.execute(
        select(LearningSpace).where(LearningSpace.user_id == user_id, LearningSpace.is_active == True)
    )
    for s in result.scalars().all():
        s.is_active = False


# ---------------------------------------------------------------------------
# Learning-space CRUD
# ---------------------------------------------------------------------------

@router.post("/spaces", response_model=SpaceSummary, status_code=201)
async def create_learning_space(
    body: CreateSpaceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new named learning space and make it the active one."""
    await _deactivate_all_spaces(current_user.id, db)

    space = LearningSpace(
        user_id=current_user.id,
        name=body.name.strip(),
        is_active=True,
    )
    db.add(space)
    await db.commit()
    await db.refresh(space)

    return SpaceSummary(id=space.id, name=space.name, is_active=True, created_at=space.created_at, path=None)


@router.get("/spaces", response_model=list[SpaceSummary])
async def list_learning_spaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LearningSpace)
        .options(
            selectinload(LearningSpace.learning_paths).selectinload(LearningPath.lessons).selectinload(Lesson.progress)
        )
        .where(LearningSpace.user_id == current_user.id)
        .order_by(LearningSpace.created_at.desc())
    )
    spaces = result.scalars().all()
    return [_format_space(s) for s in spaces]


@router.patch("/spaces/{space_id}/activate", response_model=SpaceSummary)
async def activate_learning_space(
    space_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target = await db.execute(
        select(LearningSpace).where(LearningSpace.id == space_id, LearningSpace.user_id == current_user.id)
    )
    space = target.scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=404, detail="Learning space not found")

    await _deactivate_all_spaces(current_user.id, db)
    space.is_active = True
    await db.commit()

    result = await db.execute(
        select(LearningSpace)
        .options(
            selectinload(LearningSpace.learning_paths).selectinload(LearningPath.lessons).selectinload(Lesson.progress)
        )
        .where(LearningSpace.id == space_id)
    )
    return _format_space(result.scalar_one())


# ---------------------------------------------------------------------------
# Learning-path generation (scoped to active space)
# ---------------------------------------------------------------------------

@router.post("/generate-path", response_model=LearningPathResponse)
async def generate_learning_path(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.assessment_completed:
        raise HTTPException(status_code=400, detail="Complete the assessment first")

    # Fetch most recent completed assessment
    result = await db.execute(
        select(AssessmentSession)
        .where(
            AssessmentSession.user_id == current_user.id,
            AssessmentSession.status == "completed",
        )
        .order_by(AssessmentSession.completed_at.desc())
    )
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=400, detail="No completed assessment found")

    # Ensure an active space exists; auto-create one named after the language
    active_space = await _get_active_space(current_user.id, db)
    if not active_space:
        lang_label = assessment.detected_language.title()
        # Count how many spaces this user already has for that language
        count_result = await db.execute(
            select(LearningSpace).where(
                LearningSpace.user_id == current_user.id,
                LearningSpace.name.like(f"{lang_label}%"),
            )
        )
        existing_count = len(count_result.scalars().all())
        space_name = lang_label if existing_count == 0 else f"{lang_label} {existing_count + 1}"
        active_space = LearningSpace(
            user_id=current_user.id,
            name=space_name,
            is_active=True,
        )
        db.add(active_space)
        await db.flush()

    planner = PlannerAgent()
    plan_data = await planner.generate_learning_path(
        code_snippet=assessment.code_snippet,
        language=assessment.detected_language,
        concepts=assessment.extracted_concepts or [],
        skill_level=current_user.skill_level,
        weak_areas=current_user.weak_areas or [],
        strong_areas=current_user.strong_areas or [],
        score=current_user.assessment_score or 0,
    )

    # Deactivate any existing active paths across all spaces
    existing = await db.execute(
        select(LearningPath).where(LearningPath.user_id == current_user.id, LearningPath.is_active == True)
    )
    for old_path in existing.scalars().all():
        old_path.is_active = False

    path = LearningPath(
        user_id=current_user.id,
        learning_space_id=active_space.id,
        title=plan_data["title"],
        description=plan_data.get("description", ""),
        language=assessment.detected_language,
        skill_level=current_user.skill_level,
        source_code=assessment.code_snippet,
        extracted_concepts=assessment.extracted_concepts,
        total_lessons=len(plan_data["lessons"]),
    )
    db.add(path)
    await db.flush()

    for lesson_data in plan_data["lessons"]:
        lesson = Lesson(
            learning_path_id=path.id,
            title=lesson_data["title"],
            topic=lesson_data["topic"],
            description=lesson_data.get("description", ""),
            order_index=lesson_data["order_index"],
            estimated_minutes=lesson_data.get("estimated_minutes", 20),
            difficulty=lesson_data.get("difficulty", "beginner"),
        )
        db.add(lesson)

    await db.commit()

    result2 = await db.execute(
        select(LearningPath)
        .options(selectinload(LearningPath.lessons).selectinload(Lesson.progress))
        .where(LearningPath.id == path.id)
    )
    formatted = _format_path(result2.scalar_one())

    background_tasks.add_task(
        _prefill_lesson_content,
        path_id=path.id,
        language=assessment.detected_language,
        skill_level=current_user.skill_level,
        source_code=assessment.code_snippet,
        weak_areas=current_user.weak_areas or [],
    )

    return formatted


@router.get("/path", response_model=LearningPathResponse | None)
async def get_active_path(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns the active path inside the user's active space."""
    active_space = await _get_active_space(current_user.id, db)
    if not active_space:
        return None

    result = await db.execute(
        select(LearningPath)
        .options(selectinload(LearningPath.lessons).selectinload(Lesson.progress))
        .where(
            LearningPath.learning_space_id == active_space.id,
            LearningPath.is_active == True,
        )
        .order_by(LearningPath.created_at.desc())
    )
    path = result.scalar_one_or_none()

    # Fallback: if space has no path yet, try any active path for this user (legacy data)
    if not path:
        result2 = await db.execute(
            select(LearningPath)
            .options(selectinload(LearningPath.lessons).selectinload(Lesson.progress))
            .where(LearningPath.user_id == current_user.id, LearningPath.is_active == True)
            .order_by(LearningPath.created_at.desc())
        )
        path = result2.scalar_one_or_none()

    return _format_path(path) if path else None


# ---------------------------------------------------------------------------
# Lesson endpoints (unchanged)
# ---------------------------------------------------------------------------

@router.get("/lesson/{lesson_id}", response_model=LessonResponse)
async def get_lesson(
    lesson_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lesson).options(selectinload(Lesson.progress)).where(Lesson.id == lesson_id)
    )
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if not lesson.content:
        path_result = await db.execute(
            select(LearningPath).where(LearningPath.id == lesson.learning_path_id)
        )
        path = path_result.scalar_one()

        try:
            content = await _build_lesson_content(
                topic=lesson.topic,
                title=lesson.title,
                language=path.language,
                skill_level=path.skill_level,
                source_code=path.source_code or "",
                weak_areas=current_user.weak_areas or [],
            )
            lesson.content = content
            await db.commit()
        except Exception as exc:
            logger.warning("Lesson content generation failed (will retry later): %s", exc)

    existing_progress = await db.execute(
        select(LessonProgress).where(
            LessonProgress.lesson_id == lesson.id,
            LessonProgress.user_id == current_user.id,
        )
    )
    if not existing_progress.scalar_one_or_none():
        db.add(LessonProgress(lesson_id=lesson.id, user_id=current_user.id))
        await db.commit()
        await db.refresh(lesson)

    return _format_lesson(lesson)


@router.patch("/lesson/{lesson_id}/progress")
async def update_lesson_progress(
    lesson_id: str,
    data: LessonProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LessonProgress).where(
            LessonProgress.lesson_id == lesson_id,
            LessonProgress.user_id == current_user.id,
        )
    )
    progress = result.scalar_one_or_none()
    if not progress:
        progress = LessonProgress(lesson_id=lesson_id, user_id=current_user.id)
        db.add(progress)

    just_completed = False
    lesson = None

    if data.status:
        if data.status == "in_progress" and not progress.started_at:
            progress.started_at = datetime.utcnow()
        if data.status == "completed" and not progress.completed_at:
            just_completed = True
            progress.completed_at = datetime.utcnow()
            lesson_result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
            lesson = lesson_result.scalar_one()
            path_result = await db.execute(select(LearningPath).where(LearningPath.id == lesson.learning_path_id))
            path = path_result.scalar_one()
            path.completed_lessons += 1
        progress.status = data.status

    if data.hints_used is not None:
        progress.hints_used = data.hints_used
    if data.workshop_score is not None:
        progress.workshop_score = data.workshop_score
    if data.time_spent_seconds is not None:
        progress.time_spent_seconds += data.time_spent_seconds

    # FR-03-003: auto-increase difficulty after 3 consecutive hint-free completions
    if just_completed and progress.hints_used == 0 and lesson is not None:
        recent_result = await db.execute(
            select(LessonProgress)
            .join(Lesson, LessonProgress.lesson_id == Lesson.id)
            .where(
                LessonProgress.user_id == current_user.id,
                Lesson.learning_path_id == lesson.learning_path_id,
                LessonProgress.status == "completed",
                LessonProgress.lesson_id != lesson_id,
            )
            .order_by(LessonProgress.completed_at.desc())
            .limit(2)
        )
        preceding = recent_result.scalars().all()
        if len(preceding) >= 2 and all(p.hints_used == 0 for p in preceding):
            next_result = await db.execute(
                select(Lesson)
                .where(
                    Lesson.learning_path_id == lesson.learning_path_id,
                    Lesson.order_index > lesson.order_index,
                )
                .order_by(Lesson.order_index)
                .limit(1)
            )
            next_lesson = next_result.scalar_one_or_none()
            if next_lesson:
                difficulty_order = ["beginner", "intermediate", "advanced"]
                cur_idx = (
                    difficulty_order.index(next_lesson.difficulty)
                    if next_lesson.difficulty in difficulty_order else 0
                )
                if cur_idx < len(difficulty_order) - 1:
                    next_lesson.difficulty = difficulty_order[cur_idx + 1]
                    logger.info(
                        "FR-03-003: difficulty bumped to '%s' for lesson '%s' (user %s, 3-streak)",
                        next_lesson.difficulty, next_lesson.title, current_user.id,
                    )

    await db.commit()
    return {"status": "updated"}


# ---------------------------------------------------------------------------
# Formatters
# ---------------------------------------------------------------------------

def _format_space(space: LearningSpace) -> SpaceSummary:
    # Pick the active (most recent) path in this space
    active_path = None
    if space.learning_paths:
        active = [p for p in space.learning_paths if p.is_active]
        if active:
            active_path = _format_path(active[0])
        elif space.learning_paths:
            active_path = _format_path(sorted(space.learning_paths, key=lambda p: p.created_at, reverse=True)[0])

    return SpaceSummary(
        id=space.id,
        name=space.name,
        is_active=space.is_active,
        created_at=space.created_at,
        path=active_path,
    )


def _format_path(path: LearningPath) -> LearningPathResponse:
    return LearningPathResponse(
        id=path.id,
        title=path.title,
        description=path.description,
        language=path.language,
        skill_level=path.skill_level,
        total_lessons=path.total_lessons,
        completed_lessons=path.completed_lessons,
        is_active=path.is_active,
        lessons=[_format_lesson(l) for l in path.lessons],
        created_at=path.created_at,
    )


def _format_lesson(lesson: Lesson) -> LessonResponse:
    progress_data = None
    if lesson.progress:
        p = lesson.progress
        progress_data = {
            "status": p.status,
            "hints_used": p.hints_used,
            "workshop_score": p.workshop_score,
            "time_spent_seconds": p.time_spent_seconds,
        }
    content = lesson.content
    if isinstance(content, list):
        content = next(
            (item for item in content if isinstance(item, dict) and ("explanation" in item or "key_concepts" in item)),
            content[0] if content and isinstance(content[0], dict) else None,
        )
    return LessonResponse(
        id=lesson.id,
        title=lesson.title,
        description=lesson.description,
        topic=lesson.topic,
        order_index=lesson.order_index,
        estimated_minutes=lesson.estimated_minutes,
        difficulty=lesson.difficulty,
        content=content,
        progress=progress_data,
    )
