import asyncio
import logging
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, and_
from sqlalchemy.orm import selectinload, joinedload, contains_eager

from app.database import get_db, AsyncSessionLocal
from app.models.user import User
from app.models.assessment import AssessmentSession
from app.models.learning import LearningSpace, LearningPath, Lesson, LessonProgress
from app.agents.planner import PlannerAgent
from app.agents.designer import DesignerAgent
from app.agents.code_analyzer import CodeAnalyzerAgent
from app.agents.assessment_generator import AssessmentGeneratorAgent
from app.utils.auth import get_current_user
from app.schemas.assessment import CodeAnalysis
from app.schemas.learning import (
    LearningPathResponse,
    LessonResponse,
    LessonSurrenderResponse,
    LessonProgressUpdate,
    CreateSpaceRequest,
    SpaceSummary,
    InstantDiscoveryRequest,
    InstantDiscoveryResponse,
    VizEnvelope,
)
from pydantic import ValidationError

router = APIRouter(prefix="/learning", tags=["learning"])
_lesson_generation_locks: dict[str, asyncio.Lock] = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _orchestrate_discovery_background(
    user_id: str,
    space_id: str,
    session_id: str,
    code_snippet: str,
    language: str,
    skill_level: str,
):
    """Background task to perform LLM analysis, generate 3 questions, a learning path, and the hero map."""
    analyzer = CodeAnalyzerAgent()
    planner = PlannerAgent()
    designer = DesignerAgent()
    assessment_gen = AssessmentGeneratorAgent()

    # Step 1: Perform deeper LLM analysis in background
    analysis = await analyzer.analyze(code_snippet)
    
    # Trigger Planner, Designer, and Assessment in parallel using the refined analysis
    tasks = [
        assessment_gen.generate_questions(code_snippet, analysis["concepts"], language, question_count=3),
        planner.generate_learning_path(
            code_snippet=code_snippet,
            language=language,
            concepts=analysis["concepts"],
            skill_level=skill_level,
            weak_areas=[],
            strong_areas=[],
            score=0,
        ),
        designer.generate_animation(
            topic="overview",
            title="Hero Logic Map",
            language=language,
            code_snippet=code_snippet,
        ),
    ]

    try:
        questions, plan_data, hero_anim = await asyncio.gather(*tasks)

        async with AsyncSessionLocal() as db:
            # 1. Update Assessment Session with 3 questions AND refined analysis
            await db.execute(
                update(AssessmentSession)
                .where(AssessmentSession.id == session_id)
                .values(
                    detected_language=analysis["language"],
                    code_summary=analysis.get("summary", ""),
                    extracted_concepts=analysis["concepts"],
                    concept_locations=analysis.get("concept_locations"),
                    generated_questions=questions,
                    total_questions=len(questions),
                    status="ready",
                )
            )

            # 2. Deactivate existing paths in this learning space
            await db.execute(
                update(LearningPath)
                .where(LearningPath.learning_space_id == space_id, LearningPath.is_active == True)
                .values(is_active=False)
            )

            # 3. Create the Learning Path
            path = LearningPath(
                user_id=user_id,
                learning_space_id=space_id,
                title=plan_data["title"],
                description=plan_data.get("description", ""),
                language=language,
                skill_level=skill_level,
                source_code=code_snippet,
                extracted_concepts=analysis["concepts"],
                total_lessons=len(plan_data["lessons"]),
                is_active=True,
            )
            db.add(path)
            await db.flush()

            # 4. Create Lessons
            for i, lesson_data in enumerate(plan_data["lessons"]):
                lesson = Lesson(
                    learning_path_id=path.id,
                    title=lesson_data["title"],
                    topic=lesson_data["topic"],
                    description=lesson_data.get("description", ""),
                    order_index=lesson_data["order_index"],
                    estimated_minutes=lesson_data.get("estimated_minutes", 20),
                    difficulty=lesson_data.get("difficulty", "beginner"),
                )
                
                # Attach Hero Map to the first lesson if it's an overview and we got a valid one
                if i == 0 and hero_anim and hero_anim.get("animation_frames"):
                    lesson.content = hero_anim
                
                db.add(lesson)

            await db.commit()
            logger.info("Instant Discovery background tasks completed for space %s", space_id)
            
            # Start pre-filling remaining lessons
            asyncio.create_task(_prefill_lesson_content(
                path_id=path.id,
                language=language,
                skill_level=skill_level,
                source_code=code_snippet,
                weak_areas=[],
            ))

    except Exception as exc:
        logger.error("Instant Discovery background orchestration failed: %s", exc, exc_info=True)
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(AssessmentSession)
                .where(AssessmentSession.id == session_id)
                .values(status="error")
            )
            await db.commit()


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

    content, anim_result = await asyncio.gather(
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

    if isinstance(anim_result, dict):
        if "animation_frames" in anim_result:
            content["animation_frames"] = anim_result["animation_frames"]
        if "deep_dive" in anim_result:
            content["deep_dive"] = anim_result["deep_dive"]
        if "viz" in anim_result and anim_result["viz"] is not None:
            content["viz"] = anim_result["viz"]
    elif isinstance(anim_result, list):
        content["animation_frames"] = anim_result

    # Validate the optional `viz` block. If malformed, drop it so the lesson
    # page can still render without it.
    if "viz" in content and content["viz"] is not None:
        try:
            envelope = VizEnvelope.model_validate({"viz": content["viz"]})
            walkthrough_len = len(content.get("code_walkthrough") or [])
            extra_issue = _viz_extra_validation(envelope.viz, walkthrough_len)
            if extra_issue:
                raise ValueError(extra_issue)
            content["viz"] = envelope.viz.model_dump(exclude_none=True)
        except (ValidationError, ValueError) as exc:
            logger.warning(
                "Designer emitted malformed viz for topic=%s; dropping it: %s",
                topic, exc,
            )
            content.pop("viz", None)

    return content


def _lesson_content_needs_generation(content) -> bool:
    """Return True until the full lesson page contract is available."""
    if not isinstance(content, dict):
        return True
    required_lists = ("code_walkthrough", "key_concepts", "workshops", "animation_frames")
    required_values = ("concept_hook", "summary", "deep_dive", "viz")
    return (
        any(not content.get(key) for key in required_values)
        or any(not isinstance(content.get(key), list) or not content.get(key) for key in required_lists)
    )


def _viz_extra_validation(viz, walkthrough_len: int = 0) -> str | None:
    """Cheap structural checks beyond the Pydantic schema. Returns an error
    string if invalid, else None.

    Also bounds-checks every ``code_ref.walkthrough_index`` against the
    provided ``walkthrough_len`` (length of ``code_walkthrough``).
    """
    kind = getattr(viz, "kind", None)

    def _check_ref(ref, where: str) -> str | None:
        if ref is None:
            return None
        idx = getattr(ref, "walkthrough_index", None)
        if idx is None:
            return None
        if idx >= walkthrough_len:
            return (
                f"{where} code_ref.walkthrough_index {idx} out of range "
                f"(code_walkthrough length {walkthrough_len})"
            )
        return None

    if kind == "tree":
        node_ids = {n.id for n in viz.nodes}
        if viz.root_id not in node_ids:
            return f"tree.root_id '{viz.root_id}' not in nodes"
        for n in viz.nodes:
            if n.children:
                for child_id in n.children:
                    if child_id not in node_ids:
                        return f"tree node '{n.id}' references missing child '{child_id}'"
            issue = _check_ref(n.code_ref, f"tree node '{n.id}'")
            if issue:
                return issue
    elif kind == "graph":
        node_ids = {n.id for n in viz.nodes}
        for e in viz.edges:
            if e.source not in node_ids:
                return f"graph edge source '{e.source}' not in nodes"
            if e.target not in node_ids:
                return f"graph edge target '{e.target}' not in nodes"
            issue = _check_ref(e.code_ref, f"graph edge '{e.source}->{e.target}'")
            if issue:
                return issue
        for n in viz.nodes:
            issue = _check_ref(n.code_ref, f"graph node '{n.id}'")
            if issue:
                return issue
    elif kind == "table":
        col_count = len(viz.columns)
        for row in viz.rows:
            if len(row.cells) != col_count:
                return (
                    f"table row '{row.label}' has {len(row.cells)} cells, "
                    f"expected {col_count}"
                )
            for ci, cell in enumerate(row.cells):
                issue = _check_ref(
                    cell.code_ref, f"table cell row='{row.label}' col={ci}"
                )
                if issue:
                    return issue
    elif kind == "flow":
        for s in viz.steps:
            issue = _check_ref(s.code_ref, f"flow step '{s.id}'")
            if issue:
                return issue
    return None


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

    sem = asyncio.Semaphore(1)

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
    return result.scalars().first()


async def _deactivate_all_spaces(user_id: str, db: AsyncSession):
    result = await db.execute(
        select(LearningSpace).where(LearningSpace.user_id == user_id, LearningSpace.is_active == True)
    )
    for s in result.scalars().all():
        s.is_active = False


# ---------------------------------------------------------------------------
# Learning-space CRUD
# ---------------------------------------------------------------------------

@router.post("/instant-discovery", response_model=InstantDiscoveryResponse, status_code=201)
async def instant_discovery(
    body: InstantDiscoveryRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Primary orchestration for the 'Instant Discovery' flow.
    1. Analyzes code immediately using FAST STATIC regex (SLA < 100ms).
    2. Creates a Space and an AssessmentSession.
    3. Triggers DEEP LLM analysis, Path, Hero Map, and Questions in background.
    4. Returns early to allow frontend to show the Logic Map.
    """
    # Step 1: Fast Static Analysis (Immediate Response)
    analyzer = CodeAnalyzerAgent()
    analysis = analyzer.static_analyze(body.code_snippet)
    
    language = body.language or analysis["language"]
    
    # Step 2: Create Learning Space
    await _deactivate_all_spaces(current_user.id, db)
    
    # Generate a descriptive space name from analysis
    raw_summary = analysis.get("summary", "New Logic Space")
    # Clean up summary for title: remove trailing dots, capitalize
    clean_summary = raw_summary.rstrip(".").strip()
    if len(clean_summary) > 40:
        space_name = clean_summary[:37] + "..."
    else:
        space_name = clean_summary
    
    # Fallback to language if summary is generic
    if not clean_summary or len(clean_summary) < 5:
        lang_label = language.title()
        space_name = lang_label
        
    # Ensure uniqueness
    count_result = await db.execute(
        select(LearningSpace).where(
            LearningSpace.user_id == current_user.id,
            LearningSpace.name.like(f"{space_name}%"),
        )
    )
    existing_count = len(count_result.scalars().all())
    if existing_count > 0:
        space_name = f"{space_name} ({existing_count + 1})"
    
    space = LearningSpace(
        user_id=current_user.id,
        name=space_name,
        is_active=True,
    )
    db.add(space)
    
    # Step 3: Create Assessment Session (status: generating)
    session = AssessmentSession(
        user_id=current_user.id,
        code_snippet=body.code_snippet,
        detected_language=language,
        code_summary=analysis.get("summary"),
        extracted_concepts=analysis["concepts"],
        concept_locations=analysis.get("concept_locations"),
        status="generating",
    )
    db.add(session)
    
    await db.commit()
    await db.refresh(space)
    await db.refresh(session)
    
    # Step 4: Trigger Parallel Discovery Tasks (including deep analysis)
    background_tasks.add_task(
        _orchestrate_discovery_background,
        user_id=current_user.id,
        space_id=space.id,
        session_id=session.id,
        code_snippet=body.code_snippet,
        language=language,
        skill_level=current_user.skill_level or "beginner",
    )
    
    return InstantDiscoveryResponse(
        space_id=space.id,
        session_id=session.id,
        analysis=CodeAnalysis(
            language=language,
            difficulty=analysis["difficulty"],
            concepts=analysis["concepts"],
            summary=analysis.get("summary", ""),
            concept_locations=analysis.get("concept_locations", {}),
        ),
    )


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
    # Fetch most recent assessment
    result = await db.execute(
        select(AssessmentSession)
        .where(
            AssessmentSession.user_id == current_user.id,
            AssessmentSession.status.in_(["ready", "completed"]),
        )
        .order_by(AssessmentSession.created_at.desc())
    )

    assessment = result.scalars().first()

    if not assessment:
        raise HTTPException(
            status_code=400,
            detail="No assessment session found. Please upload code first.",
        )

    # Always create a NEW learning space
    await _deactivate_all_spaces(current_user.id, db)

    planner = PlannerAgent()

    space_name = await planner.generate_space_name(
        language=assessment.detected_language or "General",
        concepts=assessment.extracted_concepts or [],
        code_summary=assessment.code_summary,
        skill_level=assessment.skill_level_result,
    )

    # Ensure uniqueness
    count_result = await db.execute(
        select(LearningSpace).where(
            LearningSpace.user_id == current_user.id,
            LearningSpace.name.like(f"{space_name}%"),
        )
    )
    existing_count = len(count_result.scalars().all())
    if existing_count > 0:
        space_name = f"{space_name} ({existing_count + 1})"

    active_space = LearningSpace(
        user_id=current_user.id,
        name=space_name,
        is_active=True,
    )

    db.add(active_space)
    await db.flush()

    # Use assessment data if completed
    weak_areas = (
        current_user.weak_areas or []
        if current_user.assessment_completed
        else []
    )

    strong_areas = (
        current_user.strong_areas or []
        if current_user.assessment_completed
        else []
    )

    score = (
        current_user.assessment_score or 0
        if current_user.assessment_completed
        else 0
    )

    plan_data = await planner.generate_learning_path(
        code_snippet=assessment.code_snippet,
        language=assessment.detected_language or "python",
        concepts=assessment.extracted_concepts or [],
        skill_level=current_user.skill_level or "beginner",
        weak_areas=weak_areas,
        strong_areas=strong_areas,
        score=score,
    )

    # Deactivate old active paths INSIDE THIS SPACE
    existing = await db.execute(
        select(LearningPath).where(
            LearningPath.learning_space_id == active_space.id,
            LearningPath.is_active == True,
        )
    )

    for old_path in existing.scalars().all():
        old_path.is_active = False

    # Create new learning path
    path = LearningPath(
        user_id=current_user.id,
        learning_space_id=active_space.id,
        title=plan_data["title"],
        description=plan_data.get("description", ""),
        language=assessment.detected_language or "python",
        skill_level=current_user.skill_level or "beginner",
        source_code=assessment.code_snippet,
        extracted_concepts=assessment.extracted_concepts,
        total_lessons=len(plan_data["lessons"]),
        is_active=True,
    )

    db.add(path)
    await db.flush()

    # Create lessons
    for lesson_data in plan_data["lessons"]:
        lesson = Lesson(
            learning_path_id=path.id,
            title=lesson_data["title"],
            topic=lesson_data["topic"],
            description=lesson_data.get("description", ""),
            order_index=lesson_data["order_index"],
            estimated_minutes=lesson_data.get(
                "estimated_minutes",
                20,
            ),
            difficulty=lesson_data.get(
                "difficulty",
                "beginner",
            ),
        )

        db.add(lesson)

    await db.commit()

    # Reload with relationships
    result2 = await db.execute(
        select(LearningPath)
        .options(
            selectinload(LearningPath.lessons)
            .selectinload(Lesson.progress)
        )
        .where(LearningPath.id == path.id)
    )

    formatted = _format_path(result2.scalar_one())

    # Background prefill
    background_tasks.add_task(
        _prefill_lesson_content,
        path_id=path.id,
        language=assessment.detected_language or "python",
        skill_level=current_user.skill_level or "beginner",
        source_code=assessment.code_snippet,
        weak_areas=weak_areas,
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
    path = result.scalars().first()

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
    # 1. Base query with eager loading for EVERYTHING needed
    stmt = (
        select(Lesson)
        .options(
            selectinload(Lesson.progress),
            contains_eager(Lesson.learning_path)
        )
        .join(LearningPath, Lesson.learning_path_id == LearningPath.id)
        .where(Lesson.id == lesson_id, LearningPath.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # 2. On-demand content generation if missing or incomplete
    if _lesson_content_needs_generation(lesson.content):
        lock = _lesson_generation_locks.setdefault(lesson_id, asyncio.Lock())
        async with lock:
            result = await db.execute(stmt)
            lesson = result.scalar_one()

            if _lesson_content_needs_generation(lesson.content):
                try:
                    # We already have lesson.learning_path loaded via contains_eager.
                    # Preserve existing hero map data if new content does not replace it.
                    existing_content = lesson.content or {}

                    new_content = await _build_lesson_content(
                        topic=lesson.topic,
                        title=lesson.title,
                        language=lesson.learning_path.language,
                        skill_level=lesson.learning_path.skill_level,
                        source_code=lesson.learning_path.source_code or "",
                        weak_areas=current_user.weak_areas or [],
                    )

                    if "animation_frames" in existing_content and (not new_content.get("animation_frames")):
                        new_content["animation_frames"] = existing_content["animation_frames"]
                    if "viz" in existing_content and (not new_content.get("viz")):
                        new_content["viz"] = existing_content["viz"]

                    lesson.content = new_content
                    await db.commit()

                    # Re-fetch to ensure all relationships are fresh and bound.
                    result = await db.execute(stmt)
                    lesson = result.scalar_one()
                except Exception as exc:
                    logger.warning("Lesson content generation failed: %s", exc)
                    await db.rollback()
                    result = await db.execute(stmt)
                    lesson = result.scalar_one()

    # 3. Ensure progress record exists
    if lesson.progress is None:
        try:
            progress = LessonProgress(lesson_id=lesson.id, user_id=current_user.id)
            db.add(progress)
            await db.commit()
        except Exception as exc:
            logger.info("Progress record might already exist: %s", exc)
            await db.rollback()

        # ALWAYS re-fetch to ensure lesson.progress is correctly populated and bound
        result = await db.execute(stmt)
        lesson = result.scalar_one()

    # We can now just use lesson.learning_path.learning_space_id without extra query
    return _format_lesson(lesson, space_id=lesson.learning_path.learning_space_id)

@router.post("/lesson/{lesson_id}/surrender", response_model=LessonSurrenderResponse)
async def surrender_lesson(
    lesson_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lesson)
        .options(selectinload(Lesson.progress))
        .join(LearningPath, Lesson.learning_path_id == LearningPath.id)
        .where(
            Lesson.id == lesson_id,
            LearningPath.user_id == current_user.id,
        )
    )
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    path_result = await db.execute(
        select(LearningPath).where(
            LearningPath.id == lesson.learning_path_id,
            LearningPath.user_id == current_user.id,
        )
    )
    path = path_result.scalar_one_or_none()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")

    progress = lesson.progress
    if progress and progress.status == "surrendered":
        raise HTTPException(status_code=409, detail="Lesson already surrendered.")

    remedial_title = f"Deep Dive: {lesson.title}"
    remedial_content = await _build_lesson_content(
        topic=lesson.topic,
        title=remedial_title,
        language=path.language,
        skill_level=path.skill_level,
        source_code=path.source_code or "",
        weak_areas=list(dict.fromkeys([lesson.topic, *(current_user.weak_areas or [])])),
    )

    if not progress:
        progress = LessonProgress(lesson_id=lesson.id, user_id=current_user.id)
        db.add(progress)
        lesson.progress = progress

    if progress.status == "completed" and path.completed_lessons > 0:
        path.completed_lessons -= 1
    
    # AC-GAP-003: A surrendered lesson is no longer "completable".
    # Decrement total_lessons so the percentage reflects only current/future valid lessons.
    if progress.status != "surrendered":
        path.total_lessons = max(0, path.total_lessons - 1)

    progress.status = "surrendered"
    progress.started_at = progress.started_at or datetime.utcnow()
    progress.completed_at = None

    insert_index = lesson.order_index + 1
    await db.execute(
        update(Lesson)
        .where(
            Lesson.learning_path_id == path.id,
            Lesson.order_index > lesson.order_index,
        )
        .values(order_index=Lesson.order_index + 1)
    )

    remedial_lesson = Lesson(
        learning_path_id=path.id,
        title=remedial_title,
        topic=lesson.topic,
        description=(
            f"Revisits {lesson.topic.replace('_', ' ')} from another angle after "
            "the previous lesson was surrendered."
        ),
        order_index=insert_index,
        estimated_minutes=lesson.estimated_minutes,
        difficulty=lesson.difficulty,
        content=remedial_content,
        is_remedial=True,
    )
    db.add(remedial_lesson)
    path.total_lessons += 1

    await db.commit()

    # Reload everything with eager progress/path to avoid async lazy-load (MissingGreenlet)
    reloaded = await db.execute(
        select(Lesson)
        .options(
            selectinload(Lesson.progress),
            joinedload(Lesson.learning_path)
        )
        .where(Lesson.id == remedial_lesson.id)
    )
    loaded_lesson = reloaded.scalar_one()

    return LessonSurrenderResponse(
        lesson=_format_lesson(loaded_lesson, space_id=loaded_lesson.learning_path.learning_space_id),
        message="A focused deep-dive lesson has been added next.",
    )


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

    if data.status and progress.status == "surrendered" and data.status != "surrendered":
        raise HTTPException(
            status_code=409,
            detail="Cannot update progress of a surrendered lesson."
        )

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


def _format_lesson(lesson: Lesson, space_id: str | None = None) -> LessonResponse:
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
        space_id=space_id,
    )
