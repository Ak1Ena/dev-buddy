# Backend & AI Architecture

## 1. Full-stack Architecture
The devBuddy AI architecture follows a decoupled, event-driven pattern where logic analysis and visual choreography are separated.

- **Frontend:** A React-based Cinematic Engine. It consumes structured "Scene JSON" and renders primitives using Framer Motion and Canvas. It maintains its own internal timeline for synchronization.
- **Backend:** A FastAPI-based AI Orchestrator. It uses AST parsing to extract structural data from code and a multi-agent system to choreograph the "performance" of that code.
- **Communication:** High-speed REST/WebSocket API using JSON Schema as the contract.

## 2. Backend Architecture
The backend is structured as a **Logic Analysis & Choreography Engine**.

- **Orchestration Layer:** FastAPI handles requests, user session management, and task queuing.
- **Analysis Layer:** 
    - **AST Parser (LibCST/ast):** Generates a structural map of the user's code. Unlike regex, this allows for precise identification of scope, data transformations, and control flow.
    - **Execution Tracing (Optional/Sandbox):** For dynamic languages, a sandbox can generate actual runtime traces to inform the scene generator.
- **Agent Layer (LangGraph):**
    - **Planner Agent:** Decides the pedagogical goal (e.g., "Explain recursion").
    - **Scene Choreographer:** Takes the AST and Pedagogical goal to produce the `Scene JSON`.
    - **Narration Agent:** Generates the Socratic voiceover/text synchronized with the timeline.

## 3. Recommended Folder Structure
```text
/
├── backend/
│   ├── app/
│   │   ├── agents/           # LangGraph agents (Planner, Choreographer)
│   │   ├── core/             # AST parsing, Logic extractors
│   │   ├── models/           # SQLAlchemy/Pydantic models
│   │   ├── routers/          # API endpoints
│   │   ├── services/         # LLM providers, Sandbox integration
│   │   └── schemas/          # Scene JSON & API schemas
├── frontend/
│   ├── src/
│   │   ├── engine/           # Cinematic Renderer & Timeline
│   │   │   ├── primitives/   # Atomic animation components
│   │   │   └── timeline/     # Sync & Playback logic
│   │   ├── components/       # UI (Navbar, Sidebar)
│   │   ├── store/            # Zustand state
│   │   └── types/            # Scene JSON Types (Shared with backend)
└── docs/
    └── architecture/         # System documentation
```

## 4. AI Orchestration Strategy
We use a **Supervisor Pattern** in LangGraph:
1. **Analyst Agent:** Parses the code using `libcst`. Extracts a "Logic Topology" (a simplified graph of the code's intent).
2. **Pedagogical Supervisor:** Reviews the Topology and the User's level. Sets the "Cinematic Beats" (key moments to visualize).
3. **Scene Generator:** Fills in the Beats with specific Primitives (box, arrow, pulse).
4. **Validation Agent:** Checks the `Scene JSON` against the schema and ensures the animation timeline matches the narration duration.
