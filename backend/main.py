import json
from fastapi import FastAPI, HTTPException
from models.user import AssessmentResponse
from agents.assessment_agent import AssessmentAgent
import os

app = FastAPI(title="devBuddy API")

# Ensure the data path is correct relative to main.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
QUESTIONS_PATH = os.path.join(BASE_DIR, "data", "assessment_questions.json")

assessment_agent = AssessmentAgent(questions_path=QUESTIONS_PATH)

@app.get("/")
async def root():
    return {"message": "Welcome to devBuddy API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/assessment/questions")
async def get_questions():
    try:
        with open(QUESTIONS_PATH, 'r') as f:
            questions = json.load(f)
        return questions
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Assessment questions not found")

@app.post("/assessment/submit")
async def submit_assessment(response: AssessmentResponse):
    # Convert keys to int since JSON sends them as strings
    answers = {int(k): v for k, v in response.answers.items()}
    result = assessment_agent.evaluate(answers)
    return {
        "user_id": response.user_id,
        "evaluation": result
    }
