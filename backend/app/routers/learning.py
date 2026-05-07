import logging
from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.assessment import AssessmentSession
from app.models.learning import LearningPath, Lesson, LessonProgress
from app.schemas.learning import LearningPathResponse, LessonResponse, LessonProgressUpdate
from app.agents.planner import PlannerAgent
from app.utils.auth import get_current_user

router = APIRouter(prefix="/learning", tags=["learning"])


@router.post("/generate-path", response_model=LearningPathResponse)
async def generate_learning_path(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.assessment_completed:
        raise HTTPException(status_code=400, detail="Complete the assessment first")

    # Fetch most recent completed assessment to get the source code
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

    # Deactivate any existing active paths
    existing = await db.execute(
        select(LearningPath).where(LearningPath.user_id == current_user.id, LearningPath.is_active == True)
    )
    for old_path in existing.scalars().all():
        old_path.is_active = False

    path = LearningPath(
        user_id=current_user.id,
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
    return _format_path(result2.scalar_one())


@router.get("/path", response_model=LearningPathResponse | None)
async def get_active_path(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LearningPath)
        .options(selectinload(LearningPath.lessons).selectinload(Lesson.progress))
        .where(LearningPath.user_id == current_user.id, LearningPath.is_active == True)
        .order_by(LearningPath.created_at.desc())
    )
    path = result.scalar_one_or_none()
    return _format_path(path) if path else None


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

    # Generate content on demand if not yet generated
    if not lesson.content:
        path_result = await db.execute(
            select(LearningPath).where(LearningPath.id == lesson.learning_path_id)
        )
        path = path_result.scalar_one()

        planner = PlannerAgent()
        try:
            content = await planner.generate_lesson_content(
                topic=lesson.topic,
                title=lesson.title,
                language=path.language,
                skill_level=path.skill_level,
                code_snippet=path.source_code or "",
                weak_areas=current_user.weak_areas or [],
            )
        except Exception as exc:
            logger.error("Lesson content generation failed: %s", exc, exc_info=True)
            raise HTTPException(status_code=500, detail=f"Lesson content generation failed: {exc}")
        lesson.content = content
        await db.commit()

    # Ensure progress record exists
    if not lesson.progress:
        progress = LessonProgress(lesson_id=lesson.id, user_id=current_user.id)
        db.add(progress)
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
    from datetime import datetime

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

    if data.status:
        if data.status == "in_progress" and not progress.started_at:
            progress.started_at = datetime.utcnow()
        if data.status == "completed" and not progress.completed_at:
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

    await db.commit()
    return {"status": "updated"}


def _format_path(path: LearningPath) -> LearningPathResponse:
    return LearningPathResponse(
        id=path.id,
        title=path.title,
        description=path.description,
        language=path.language,
        skill_level=path.skill_level,
        total_lessons=path.total_lessons,
        completed_lessons=path.completed_lessons,
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
    return LessonResponse(
        id=lesson.id,
        title=lesson.title,
        description=lesson.description,
        topic=lesson.topic,
        order_index=lesson.order_index,
        estimated_minutes=lesson.estimated_minutes,
        difficulty=lesson.difficulty,
        content=lesson.content,
        progress=progress_data,
    )
