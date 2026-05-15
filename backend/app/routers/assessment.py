import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db, AsyncSessionLocal
from app.models.user import User
from app.models.assessment import AssessmentSession, AssessmentAnswer
from app.models.analytics import SkillProgression
from app.schemas.assessment import (
    AssessmentStart,
    AssessmentStartResponse,
    AssessmentSubmitAnswer,
    AssessmentAnswerResult,
    AssessmentResult,
    CodeAnalysis,
    AssessmentQuestion,
)
from app.agents.code_analyzer import CodeAnalyzerAgent
from app.agents.assessment_generator import AssessmentGeneratorAgent, check_answer, calculate_score
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assessment", tags=["assessment"])

def get_code_analyzer() -> CodeAnalyzerAgent:
    return CodeAnalyzerAgent()

def get_assessment_generator() -> AssessmentGeneratorAgent:
    return AssessmentGeneratorAgent()


async def run_assessment_generation_task(session_id: str, code_snippet: str):
    """Background task to analyze code and generate questions (SLA compliance)."""
    async with AsyncSessionLocal() as db:
        try:
            code_analyzer = get_code_analyzer()
            assessment_generator = get_assessment_generator()

            # Step 1: Analyze the code
            analysis = await code_analyzer.analyze(code_snippet)

            # Step 2: Generate 10 questions
            questions_with_answers = await assessment_generator.generate_questions(
                code_snippet=code_snippet,
                concepts=analysis["concepts"],
                language=analysis["language"],
                question_count=10,
            )

            # Update session
            result = await db.execute(select(AssessmentSession).where(AssessmentSession.id == session_id))
            session = result.scalar_one_or_none()
            if session:
                session.detected_language = analysis["language"]
                session.code_summary = analysis.get("summary", "")
                session.extracted_concepts = analysis["concepts"]
                session.concept_locations = analysis.get("concept_locations", {})
                session.generated_questions = questions_with_answers
                session.total_questions = len(questions_with_answers)
                session.status = "ready"
                await db.commit()
                logger.info("Assessment session %s is ready", session_id)
        except Exception as exc:
            logger.error("Background assessment generation failed for session %s: %s", session_id, exc, exc_info=True)
            result = await db.execute(select(AssessmentSession).where(AssessmentSession.id == session_id))
            session = result.scalar_one_or_none()
            if session:
                session.status = "error"
                await db.commit()


@router.post("/start", response_model=AssessmentStartResponse)
async def start_assessment(
    data: AssessmentStart,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Create session in 'generating' status
    session = AssessmentSession(
        user_id=current_user.id,
        code_snippet=data.code_snippet,
        status="generating",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Trigger background task
    background_tasks.add_task(run_assessment_generation_task, session.id, data.code_snippet)

    # Return immediately with 'generating' status (Frontend will poll)
    return AssessmentStartResponse(
        session_id=session.id,
        code_analysis=CodeAnalysis(
            language="detecting...",
            difficulty="beginner",
            concepts=[],
            summary="Analyzing your code...",
            concept_locations={},
        ),
        questions=[], # Empty for now
    )


@router.get("/session/{session_id}")
async def get_assessment_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentSession).where(
            AssessmentSession.id == session_id,
            AssessmentSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Map to AssessmentStartResponse format for easy consumption
    client_questions = []
    if session.generated_questions:
        client_questions = [
            AssessmentQuestion(
                id=q["id"],
                question=q["question"],
                options=q["options"],
                topic=q["topic"],
                difficulty=q["difficulty"],
                code_reference=q.get("code_reference"),
            )
            for q in session.generated_questions
        ]

    return {
        "session_id": session.id,
        "status": session.status,
        "code_analysis": {
            "language": session.detected_language,
            "difficulty": session.skill_level_result or "beginner",
            "concepts": session.extracted_concepts or [],
            "summary": session.code_summary or "",
            "concept_locations": session.concept_locations or {},
        },
        "questions": client_questions,
    }


@router.post("/submit-answer", response_model=AssessmentAnswerResult)
async def submit_answer(
    data: AssessmentSubmitAnswer,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentSession).where(
            AssessmentSession.id == data.session_id,
            AssessmentSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.generated_questions:
        raise HTTPException(status_code=400, detail="No questions found for this session")

    check = check_answer(session.generated_questions, data.question_id, data.answer_key)

    answer = AssessmentAnswer(
        session_id=session.id,
        question_id=data.question_id,
        question_text=check["question_text"],
        topic=check["topic"],
        difficulty=check["difficulty"],
        user_answer=data.answer_key,
        correct_answer=check["correct_answer"],
        is_correct=check["is_correct"],
        explanation=check.get("explanation", ""),
    )
    db.add(answer)
    if check["is_correct"]:
        session.correct_answers += 1
    await db.commit()

    return AssessmentAnswerResult(
        is_correct=check["is_correct"],
        correct_answer=check["correct_answer"],
        explanation=check.get("explanation", ""),
    )


@router.post("/complete/{session_id}", response_model=AssessmentResult)
async def complete_assessment(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentSession).where(
            AssessmentSession.id == session_id,
            AssessmentSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    answers_result = await db.execute(
        select(AssessmentAnswer).where(AssessmentAnswer.session_id == session_id)
    )
    answers = [
        {"is_correct": a.is_correct, "topic": a.topic}
        for a in answers_result.scalars().all()
    ]

    score_data = calculate_score(answers)

    session.status = "completed"
    session.score = score_data["score"]
    session.skill_level_result = score_data["skill_level"]
    session.identified_topics = {
        "strong": score_data["strong_areas"],
        "weak": score_data["weak_areas"],
    }
    session.completed_at = datetime.now(timezone.utc)

    current_user.assessment_completed = True
    current_user.assessment_score = score_data["score"]
    current_user.skill_level = score_data["skill_level"]
    current_user.strong_areas = score_data["strong_areas"]
    current_user.weak_areas = score_data["weak_areas"]

    # FR-05-003: snapshot skill profile so retention score can be computed over time
    db.add(SkillProgression(
        user_id=current_user.id,
        trigger="assessment_complete",
        skill_level=score_data["skill_level"],
        assessment_score=score_data["score"],
        weak_areas=score_data["weak_areas"],
        strong_areas=score_data["strong_areas"],
    ))

    await db.commit()

    return AssessmentResult(
        session_id=session_id,
        score=score_data["score"],
        skill_level=score_data["skill_level"],
        strong_areas=score_data["strong_areas"],
        weak_areas=score_data["weak_areas"],
        recommendation=score_data["recommendation"],
        language=session.detected_language,
        concepts=session.extracted_concepts or [],
    )
