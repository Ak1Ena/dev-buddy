from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

from .assessment.agent import AssessmentAgent
from .agents.orchestrator import create_orchestrator_graph

app = FastAPI(title="devBuddy API")

# --- Schemas ---
class SubjectSelection(BaseModel):
    subject: str
    user_id: Optional[str] = None

class AssessmentSubmission(BaseModel):
    user_id: str
    subject: str
    answers: List[str]

class UserProfile(BaseModel):
    user_id: str
    subject: str
    level: str
    last_assessment: datetime

# --- In-memory Store ---
user_profiles = {}
user_paths = {} # user_id -> {path: [], current_index: 0}

# Initialize Graph
orchestrator = create_orchestrator_graph()

@app.get("/")
async def root():
    return {"message": "Welcome to devBuddy API! 🎓", "status": "Full Power Mode Active"}

@app.post("/api/setup-assessment")
async def setup_assessment(selection: SubjectSelection):
    if not selection.subject:
        raise HTTPException(status_code=400, detail="Subject is required")
    
    session_id = str(uuid.uuid4())
    return {
        "status": "success",
        "session_id": session_id,
        "subject": selection.subject,
        "message": f"Assessment for {selection.subject} is ready."
    }

@app.post("/api/assessment/submit")
async def submit_assessment(submission: AssessmentSubmission):
    # 1. Score the assessment
    agent = AssessmentAgent(submission.subject)
    # Mock questions for scoring
    questions = agent.generate_questions() 
    result = agent.score_assessment(submission.answers, questions)
    
    # 2. Save User Profile
    profile = UserProfile(
        user_id=submission.user_id,
        subject=submission.subject,
        level=result.level,
        last_assessment=datetime.now()
    )
    user_profiles[submission.user_id] = profile
    
    # 3. Generate Initial Path using Orchestrator
    state = {
        "user_id": submission.user_id,
        "subject": submission.subject,
        "user_level": result.level,
        "plan": [],
        "current_topic_index": 0,
        "content": {},
        "verification_status": "",
        "iterations": 0,
        "curiosity_trigger": False
    }
    
    final_state = orchestrator.invoke(state)
    user_paths[submission.user_id] = {
        "path": final_state["plan"],
        "current_index": 0
    }
    
    return {
        "status": "success",
        "level": result.level,
        "score": result.score,
        "path": final_state["plan"],
        "message": f"Welcome {result.level}! Your personalized path is ready."
    }

@app.get("/api/lesson/next/{user_id}")
async def get_next_lesson(user_id: str):
    if user_id not in user_profiles:
        raise HTTPException(status_code=404, detail="User profile not found. Please take assessment first.")
    
    profile = user_profiles[user_id]
    path_data = user_paths.get(user_id, {"path": [], "current_index": 0})
    
    if path_data["current_index"] >= len(path_data["path"]):
        return {"message": "Course completed! Congratulations! 🎓"}
    
    # Trigger Orchestrator to generate verified content for the current topic
    state = {
        "user_id": user_id,
        "subject": profile.subject,
        "user_level": profile.level,
        "plan": path_data["path"],
        "current_topic_index": path_data["current_index"],
        "content": {},
        "verification_status": "",
        "iterations": 0,
        "curiosity_trigger": False
    }
    
    final_state = orchestrator.invoke(state)
    
    # Move to next lesson for next call
    user_paths[user_id]["current_index"] += 1
    
    return {
        "topic": path_data["path"][path_data["current_index"]],
        "content": final_state["content"],
        "progress": f"{path_data['current_index'] + 1}/{len(path_data['path'])}"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
