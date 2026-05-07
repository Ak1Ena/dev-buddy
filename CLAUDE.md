# devBuddy AI — CLAUDE.md

## Project Overview
AI-powered Socratic programming mentor for beginners. The AI NEVER gives direct code answers — it guides through questions and progressive hints.

## Structure
```
dev-buddy/
├── backend/          # FastAPI + Python
│   └── app/
│       ├── agents/   # AI agents (socratic_mentor, planner, assessment_agent)
│       ├── models/   # SQLAlchemy models
│       ├── routers/  # API endpoints
│       ├── schemas/  # Pydantic schemas
│       └── utils/    # Auth utilities
├── frontend/         # Next.js 14 + TypeScript
│   └── src/
│       ├── app/      # App Router pages
│       ├── components/
│       ├── lib/      # api.ts, utils.ts
│       ├── store/    # Zustand stores
│       └── types/    # TypeScript types
└── tests/
```

## Key Commands
```bash
# Backend dev
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend dev
cd frontend && npm install && npm run dev

# Docker (full stack)
cp .env.example .env  # Add your ANTHROPIC_API_KEY
docker-compose up
```

## Environment
Copy `.env.example` to `.env` and fill in:
- `ANTHROPIC_API_KEY` — required for AI features
- `SECRET_KEY` and `JWT_SECRET_KEY` — change for production

## Core Principle
The Socratic Mentor (`backend/app/agents/socratic_mentor.py`) must NEVER give direct code answers. It uses hint levels 0-3. Do not change this behavior.

## Tech Stack
- Backend: FastAPI, SQLAlchemy (async), Python-jose JWT, Passlib bcrypt, Anthropic SDK
- Frontend: Next.js 14 App Router, TypeScript, Tailwind CSS, Zustand, Lucide React
- Database: SQLite (dev), PostgreSQL (prod)
- AI: Claude claude-sonnet-4-6 via Anthropic API
