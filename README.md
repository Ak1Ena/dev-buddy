# devBuddy AI 🎓

The AI-powered senior mentor for the **Self-Taught Developer**.

## Core Concept

Most online courses give you a rigid path and a generic certificate. Most AI tools just give you the answer.

**devBuddy is different.** We provide the senior-level mentorship that self-taught developers often miss. 

Whether you're building your first project or trying to master a complex library, devBuddy helps you bridge the gap between "making it work" and "knowing how it works."

## The Self-Taught Journey (Instant Discovery)

```
1. Paste Logic: Input your project logic or a concept you're wrestling with.
      ↓
2. Visualize: Instantly see interactive Logic Maps that visualize the flow of your code.
      ↓
3. Master: Use Socratic Discovery Gates to build genuine technical depth.
```

**Note:** The previous 10-question assessment gate has been removed to prioritize immediate, curiosity-driven learning.

## Why This Matters for Self-Taught Coders

**The Problem:** Without a traditional classroom or a senior lead, self-taught developers often build "knowledge silos"—they know how to use a tool but struggle with the underlying computer science patterns.

**The Solution:** devBuddy acts as your "Personal Senior Developer." We don't just help you fix bugs; we help you **level up your thinking** through Socratic dialogue and cinematic logic visualization.

## Features

### Instant Discovery Engine
Instead of generic quizzes, devBuddy instantly analyzes your code and generates a high-fidelity logic map, allowing you to dive straight into exploration.

### Logic Map Visualization (Discovery Gates)
We transform abstract code into interactive, graph-based flowcharts. See the "Logic Topology" of your programs. Discovery Gates force active prediction at key logic branches.

### Socratic Senior Mentor
Our AI mentor never spoils the answer. It asks the high-signal questions a senior engineer would ask, guiding you to discover architectural insights yourself.

### Adaptive Curriculum
Every lesson is generated dynamically based on your specific project needs and current skill level, ensuring you're always working at the edge of your ability.

## AI Orchestration

| Agent | Role |
|---|---|
| **Code Analyzer** | Parses submitted code, extracts concepts, estimates difficulty |
| **Planner** | Builds a lesson sequence based on extracted concepts |
| **Content Designer** | Generates lesson content grounded in the user's code |
| **Socratic Mentor** | Answers questions with guiding questions, never direct solutions |

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** Python + FastAPI
- **AI:** Claude API (claude-3-7-sonnet) — all agents
- **Database:** SQLite (dev) / PostgreSQL (prod)
- **Code Editor:** Monaco Editor (same as VS Code)

## Project Structure

```
dev-buddy/
├── backend/
│   └── app/
│       ├── agents/         # AI agents (analyzer, planner, mentor, etc.)
│       ├── models/         # Database models
│       ├── routers/        # API endpoints
│       ├── schemas/        # Request/response validation
│       └── main.py
├── frontend/
│   └── src/
│       ├── pages/          # Landing, Assessment, Dashboard, Learn
│       ├── components/     # UI, Visualization, Workshop
│       ├── store/          # Auth state (Zustand)
│       └── lib/            # API client
├── tests/
├── docker-compose.yml
└── .env.example
```

## Getting Started

```bash
# 1. Clone and configure
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

# 2. Run with Docker
docker-compose up

# 3. Or run locally
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
cd frontend && npm install && npm run dev
```

Open http://localhost:3000 — paste some code and start learning.
