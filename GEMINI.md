# devBuddy AI 🎓

The AI-powered senior mentor for the **Self-Taught Developer**.

## 🎯 Core Vision
devBuddy AI is the "Senior Lead" that independent learners are missing. It bridges the gap between "making it work" and "knowing how it works" through **Socratic Mentorship** and **Cinematic Logic Visualization**.

## 🧠 Philosophy: The "Teacher, Not Movie" Rule
1. **Socratic Priority:** Questions are the "Soul" of the project. Visuals are the "Evidence." Never provide an answer without first asking a high-signal question.
2. **Active Discovery:** Use **Checkpoints** in all visualizations. The UI must pause at critical logic branches to force the user to predict the outcome before revealing the next node.
3. **Graph-First Learning:** Prioritize **Logic Topologies** (Flowcharts/State Machines) over raw code blocks. This removes "Syntax-Blindness" and builds spatial mental models of logic.
4. **Senior-Level Depth:** Every lesson includes a **Technical Deep Dive** that explains "The Why" (memory management, architectural patterns, traps) to move the user from beginner to expert.

## 🛠 Tech Stack & Architecture
- **Backend:** FastAPI (Python 3.11+).
    - Environment: `.venv` at `./backend/.venv`.
    - **Polyglot Logic Engine:** Language-agnostic analysis that extracts universal patterns from ANY code (Rust, C++, SQL, etc.).
    - **Open WebUI Support:** Configurable via `.env` (`LLM_PROVIDER=openwebui`) to support private LLM infrastructure.
- **Frontend:** React + TypeScript + Vite + Node.js.
    - **Vertical Visual Stack:** The "Hero Logic Map" (Graph) sits at the top, with "Theory" (Deep Dive) and "Dialogue" (AI Mentor) side-by-side below.
    - **Animation Engine:** Framer Motion + Canvas powered by JSON logic frames.

## 🎨 Visual Language (Logic Topology)
- **Fuchsia:** Decision Nodes (`if`, `loops`, conditions).
- **Sky:** Action Nodes (Assignments, transformations).
- **Emerald:** Outcome Nodes (`return`, success states).
- **Amber:** Checkpoints & Active Discovery prompts.

## 🚀 Development Standards
1. **Instructional Integrity:** Every feature must reinforce analytical thinking, not just provide convenience.
2. **Performance:** Maintain a < 3s SLA for logic generation using static regex fallbacks in `code_analyzer.py` when necessary.
3. **Build Safety:** Always run `cd frontend && npm run build` to verify type-safety after UI changes.
