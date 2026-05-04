# devBuddy 🎓

An AI-powered programming tutor that builds personalized, dynamic learning paths based on your current knowledge and goals.

## Overview
devBuddy creates a custom study schedule and content for each user. Unlike static courses, it adapts in real-time to your questions and progress, ensuring that every lesson is relevant and fact-checked by a specialized AI agent.

## Pain Points
- **One-Size-Fits-All Curriculums:** Most coding courses are rigid and don't adapt to a user's existing knowledge or learning pace.
- **AI Hallucinations:** Generic AI tutors often provide incorrect or outdated code without verification.
- **Information Overload:** Beginners are often overwhelmed by the sheer volume of resources and don't know what to focus on.
- **Lack of Real-time Feedback:** Static tutorials don't allow users to ask follow-up questions or get personalized clarifications.

## Design Goals
1. **Initial Assessment:** A 10-question evaluation to understand the user's baseline knowledge.
2. **Dynamic Scheduling:** Lessons are scheduled and generated specifically for the user's profile.
3. **Rich Learning Content:**
   - Step-by-step code examples.
   - Interactive animations for better conceptual understanding.
4. **Adaptive Learning:** Users can ask questions, and the "Teacher" can dynamically add lessons to the schedule to address gaps.

## AI Orchestration (Agent Roles)
The system uses a multi-agent architecture to ensure quality and personalization:

- **Planner:** Creates the lesson schedule based on user profiles.
- **Analysis:** Evaluates if the plan fits the user's specific needs and level.
- **Design:** Crafts the lesson content, examples, and interactive elements.
- **Checker:** Cross-checks all information against reliable sources to ensure accuracy.

## Project Structure
```text
devBuddy/
├── backend/             # Python logic (LangChain, Agents)
│   ├── agents/          # Agent logic (Planner, Analysis, Design, Checker)
│   ├── assessment/      # Initial 10-question evaluation logic
│   ├── content/         # Lesson generation logic
│   ├── utils/           # Fact-checking tools
│   └── main.py          # FastAPI/Flask entry point
├── frontend/            # React/TypeScript application
│   ├── src/
│   │   ├── components/  # Interactive lesson components
│   │   ├── hooks/       # API interaction logic
│   │   └── App.tsx
│   └── package.json
├── tests/               # Unit and integration tests
├── data/                # Reference materials and knowledge base
├── .env                 # API keys
├── requirements.txt     # Python dependencies
└── README.md
```

## Tech Stack
- **Backend:** Python, LangChain, FastAPI/Flask
- **Frontend:** React, TypeScript, CSS (for animations)
- **Database:** Vector Database (for RAG/Fact-checking)
