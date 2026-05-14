from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from app.agents.choreographer import ChoreographerAgent
import uuid

router = APIRouter(prefix="/scenes", tags=["scenes"])

# Simple in-memory store for scenes (SessionID -> SceneJSON)
# KNOWN LIMITATION: This grows indefinitely. In production, use Redis with TTL or a database.
SCENE_CACHE: Dict[str, Any] = {}

class AnalyzeRequest(BaseModel):
    code: str

class AnalyzeResponse(BaseModel):
    session_id: str

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_code(request: AnalyzeRequest):
    choreographer = ChoreographerAgent()
    scene = await choreographer.choreograph(request.code)
    
    session_id = str(uuid.uuid4())
    SCENE_CACHE[session_id] = scene
    
    return AnalyzeResponse(session_id=session_id)

@router.get("/scene/{session_id}")
async def get_scene(session_id: str):
    if session_id not in SCENE_CACHE:
        raise HTTPException(status_code=404, detail="Scene not found")
    return SCENE_CACHE[session_id]
