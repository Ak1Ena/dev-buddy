from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.ai_gateway.crypto import ensure_credential_key
from app.ai_gateway.usage import flush_usage
from app.config import check_app_secrets, get_settings
from app.database import init_db
from app.routers import auth, assessment, learning, chat, analytics, scenes, ai

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail at startup, not at first save or first forged token, if the credential
    # key is missing or the JWT/app secret is a placeholder outside development.
    check_app_secrets(settings)
    ensure_credential_key()
    await init_db()
    yield
    await flush_usage()


app = FastAPI(
    title="devBuddy AI",
    description="Interactive Socratic Programming Mentor API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.app_env == "development" else None,
    redoc_url="/redoc" if settings.app_env == "development" else None,
)

# CORS must be added FIRST so headers are present even on error responses
app.add_middleware(
    CORSMiddleware,
    # Defaults plus ALLOWED_ORIGINS from .env (e.g. a worktree frontend on another port).
    # cors_origins drops "*", which is unsafe with allow_credentials=True.
    allow_origins=sorted({"http://localhost:5173", "http://localhost:3000", *settings.cors_origins}),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(assessment.router, prefix="/api/v1")
app.include_router(learning.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(scenes.router, prefix="/api/v1")
# M1 contract (docs/architecture/m1-ai-gateway.md) puts these at /api/ai, not /api/v1.
app.include_router(ai.router, prefix="/api")


import logging

logger = logging.getLogger(__name__)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    
    # In production, don't leak details. In development, you might want them.
    detail = "Internal Server Error"
    if settings.app_env == "development":
        detail = str(exc)
        
    return JSONResponse(
        status_code=500, 
        content={"detail": detail}
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "devBuddy AI"}
