# devBuddy AI 🎓

The AI-powered senior mentor for the **Self-Taught Developer**.

## Core Concept

Most online courses give you a rigid path and a generic certificate. Most AI tools just give you the answer.

**devBuddy is different.** We provide the senior-level mentorship that self-taught developers often miss. 

Whether you're building your first project or trying to master a complex library, devBuddy helps you bridge the gap between "making it work" and "knowing how it works."

## The Self-Taught Journey

```
1. Input your project logic or a concept you're wrestling with
      ↓
2. AI identifies the "Mental Model" gaps in your current understanding
      ↓
3. Interactive Logic Maps visualize the flow of your code (Graph-First)
      ↓
4. Socratic Mentorship guides you to the solution through analytical thinking
      ↓
5. Build genuine technical depth that translates to real-world engineering
```

## Why This Matters for Self-Taught Coders

**The Problem:** Without a traditional classroom or a senior lead, self-taught developers often build "knowledge silos"—they know how to use a tool but struggle with the underlying computer science patterns.

**The Solution:** devBuddy acts as your "Personal Senior Developer." We don't just help you fix bugs; we help you **level up your thinking** through Socratic dialogue and cinematic logic visualization.

## Features

### Mastery-Based Assessment
Instead of generic quizzes, devBuddy analyzes your code to find exactly where your conceptual foundation needs strengthening.

### Logic Map Visualization
We transform abstract code into interactive, graph-based flowcharts. See the "Logic Topology" of your programs to build a permanent mental model of how data and control flow work.

### Socratic Senior Mentor
Our AI mentor never spoils the answer. It asks the high-signal questions a senior engineer would ask, guiding you to discover architectural insights yourself.

### Adaptive Curriculum
Every lesson is generated dynamically based on your specific project needs and current skill level, ensuring you're always working at the edge of your ability.

## AI Orchestration

| Agent | Role |
|---|---|
| **Code Analyzer** | Parses submitted code, extracts concepts, estimates difficulty |
| **Assessment Generator** | Creates 10 targeted questions from the code's concepts |
| **Planner** | Builds a lesson sequence based on quiz results |
| **Content Designer** | Generates lesson content grounded in the user's code |
| **Socratic Mentor** | Answers questions with guiding questions, never direct solutions |

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** Python + FastAPI
- **AI:** Claude API (claude-sonnet-4-6) — all agents
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
