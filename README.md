# devBuddy AI 🎓

An AI-powered Socratic programming mentor that starts with **your code** — not a generic curriculum.

## Core Concept

Most learning platforms ask "what language do you want to learn?" and hand you a cookie-cutter course.

**devBuddy does the opposite:**

> Paste code you found, copied, or wrote — and don't fully understand.
> devBuddy analyzes it, quizzes you on the exact concepts inside it, then teaches you everything you need to actually understand it.

You learn the concepts behind *your* code, not abstract textbook examples.

## User Flow

```
1. Paste your code
      ↓
2. AI analyzes it → identifies concepts, patterns, and complexity
      ↓
3. Get 10 questions generated from your specific code
      ↓
4. AI scores your answers → finds what you know vs. don't know
      ↓
5. Get 10 personalized lessons that explain your code concept by concept
      ↓
6. Chat with the Socratic AI mentor while working through each lesson
```

## Why This Approach

**The real problem:** Beginners today copy code from Stack Overflow, GitHub Copilot, or ChatGPT — and ship it without understanding it. When it breaks, they're stuck.

**The solution:** Instead of ignoring this behavior, devBuddy uses it as the starting point. Paste the code you don't understand. We'll meet you exactly where you are.

## Pain Points Solved

- **"I copied this code but have no idea how it works"** — That's the entry point, not a problem to avoid.
- **Generic curriculums** — Every learning path is generated from *your* actual code, not a template.
- **AI dependency** — The Socratic mentor never gives direct answers. It asks guiding questions that make you think.
- **Abstract concepts** — Lessons are grounded in your real code, not toy examples.
- **Learning fatigue** — You're always working toward understanding something you actually care about.

## Features

### Code-Based Assessment
Paste any code snippet. The AI identifies every concept present (loops, recursion, closures, etc.) and generates 10 targeted questions that test whether you understand those specific concepts.

### Personalized Lesson Generation
Based on your quiz answers, the AI builds a lesson plan covering only what you need to learn — ordered from foundational gaps to advanced concepts found in your code.

### Socratic AI Mentor
Every lesson has a chat interface. The mentor never gives you the answer directly. It asks questions that guide you to the insight yourself:
- *"What do you think happens to `i` at the end of each loop iteration?"*
- *"Why do you think the function returns `None` here instead of a value?"*

### Adaptive Hints (3 Levels)
When you're stuck, hints escalate gradually:
1. Conceptual nudge
2. Point at the specific line/pattern
3. Show a similar (different) worked example

### Runtime Visualization
Step through your code visually — watch variables change value, loops iterate, and the call stack grow and shrink.

### Interactive Workshops
Exercises built around your code:
- **Predict the Output** — what does this print?
- **Debug the Challenge** — find the bug
- **Fill in the Blank** — complete the missing part
- **Explain the Line** — describe what this does in plain English

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
