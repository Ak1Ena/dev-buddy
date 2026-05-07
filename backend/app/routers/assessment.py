import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.assessment import AssessmentSession, AssessmentAnswer
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

router = APIRouter(prefix="/assessment", tags=["assessment"])

def get_code_analyzer() -> CodeAnalyzerAgent:
    return CodeAnalyzerAgent()

def get_assessment_generator() -> AssessmentGeneratorAgent:
    return AssessmentGeneratorAgent()


@router.post("/start", response_model=AssessmentStartResponse)
async def start_assessment(
    data: AssessmentStart,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    code_analyzer = get_code_analyzer()
    assessment_generator = get_assessment_generator()

    # Step 1: Analyze the code
    try:
        analysis = await code_analyzer.analyze(data.code_snippet)
    except Exception as exc:
        logger.error("Code analysis failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Code analysis failed: {exc}")

    # Step 2: Generate 10 questions from the code
    try:
        questions_with_answers = await assessment_generator.generate_questions(
            code_snippet=data.code_snippet,
            concepts=analysis["concepts"],
            language=analysis["language"],
        )
    except Exception as exc:
        logger.error("Question generation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Question generation failed: {exc}")

    # Step 3: Save session (questions stored server-side with answers)
    session = AssessmentSession(
        user_id=current_user.id,
        code_snippet=data.code_snippet,
        detected_language=analysis["language"],
        code_summary=analysis.get("summary", ""),
        extracted_concepts=analysis["concepts"],
        concept_locations=analysis.get("concept_locations", {}),
        generated_questions=questions_with_answers,
        total_questions=len(questions_with_answers),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Step 4: Return questions WITHOUT correct answers
    client_questions = [
        AssessmentQuestion(
            id=q["id"],
            question=q["question"],
            options=q["options"],
            topic=q["topic"],
            difficulty=q["difficulty"],
            code_reference=q.get("code_reference"),
        )
        for q in questions_with_answers
    ]

    return AssessmentStartResponse(
        session_id=session.id,
        code_analysis=CodeAnalysis(
            language=analysis["language"],
            difficulty=analysis["difficulty"],
            concepts=analysis["concepts"],
            summary=analysis.get("summary", ""),
            concept_locations=analysis.get("concept_locations", {}),
        ),
        questions=client_questions,
    )


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
    session.completed_at = datetime.utcnow()

    current_user.assessment_completed = True
    current_user.assessment_score = score_data["score"]
    current_user.skill_level = score_data["skill_level"]
    current_user.strong_areas = score_data["strong_areas"]
    current_user.weak_areas = score_data["weak_areas"]

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
