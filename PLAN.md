# devBuddy Project Plan 🚀

## Phase 1: Foundation & Assessment
- [ ] Implement subject selection logic (User chooses what to learn).
- [ ] Define the 10-question logic to baseline user knowledge based on the selected subject.
- [ ] Implement the Assessment Agent to generate and process user answers.
- [ ] Create the data schema for User Profiles and Learning Paths.

## Phase 2: AI Orchestration (The "Brain")
- [ ] Implement the **Planner Agent**: Generate a personalized curriculum.
- [ ] Implement the **Analysis Agent**: Validate and refine the plan.
- [ ] Implement the **Design Agent**: Generate structured lesson content (JSON).
- [ ] Implement the **Checker Agent**: Integrate RAG for fact-checking and referencing.

## Phase 3: Backend API
- [ ] Setup FastAPI/Flask server.
- [ ] Create endpoints for assessment, lesson retrieval, and user questions.
- [ ] Implement state management for the learning journey (LangGraph).

## Phase 4: Frontend Development
- [ ] Setup React/TypeScript boilerplate.
- [ ] Build the Assessment UI.
- [ ] Create the Lesson Player (Content, Code Examples, Animations).
- [ ] Implement the Chat interface for asking the "Teacher" questions.

## Phase 5: Polish & Refinement
- [ ] Add interactive animations for complex concepts.
- [ ] Implement the **Curiosity Loop**: Logic to detect deep-dive interests and trigger real-time learning path modifications.
- [ ] Implement real-time schedule updates when users struggle or excel.
- [ ] End-to-end testing and deployment.
