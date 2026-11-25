from collections import OrderedDict
from typing import Any
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.agents.choreographer import ChoreographerAgent
from app.models.user import User
from app.utils.auth import get_current_user

router = APIRouter(prefix="/scenes", tags=["scenes"])

# In-memory store: session id -> (owner user id, scene JSON). Capped so it cannot
# grow without bound; the oldest scene is dropped first. Use Redis/DB with a TTL
# if scenes ever need to survive a restart.
_SCENE_CACHE_SIZE = 500
SCENE_CACHE: "OrderedDict[str, tuple[str, Any]]" = OrderedDict()


class AnalyzeRequest(BaseModel):
    code: str


class AnalyzeResponse(BaseModel):
    session_id: str


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_code(request: AnalyzeRequest, current_user: User = Depends(get_current_user)):
    # Logged-in only, and the call runs on the user's own AI settings: before this,
    # anyone who could reach the port spent the server's .env key (Vex review F2).
    choreographer = ChoreographerAgent(current_user.id)
    scene = await choreographer.choreograph(request.code)

    session_id = str(uuid.uuid4())
    SCENE_CACHE[session_id] = (current_user.id, scene)
    while len(SCENE_CACHE) > _SCENE_CACHE_SIZE:
        SCENE_CACHE.popitem(last=False)

    return AnalyzeResponse(session_id=session_id)


@router.get("/scene/{session_id}")
async def get_scene(session_id: str, current_user: User = Depends(get_current_user)):
    entry = SCENE_CACHE.get(session_id)
    # Same 404 for "missing" and "someone else's", so ids cannot be probed.
    if entry is None or entry[0] != current_user.id:
        raise HTTPException(status_code=404, detail="Scene not found")
    return entry[1]
