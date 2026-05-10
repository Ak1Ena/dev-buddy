# devBuddy AI — TODO

## Proposal updates

### [x] Promote Misconception Detection from roadmap to current feature
**Why:** It's already shipped — `CodeAnalyzerAgent.detect_misconceptions` runs inside `PlannerAgent.generate_learning_path` (`backend/app/agents/planner.py:182`) and the detected misconceptions are injected into the LLM prompt so each generated lesson explicitly addresses the student's specific error patterns. Currently it lives in §9 (Roadmap) where it gets undersold as "future work."

**Edit plan for `proposal.md`:**
- Remove "Intelligent Misconception Detection" bullet from §9.
- Add a new §4.5 *Code-Level Misconception Detection* (Thai + English in the existing bilingual style) describing:
  - The agent inspects the student's actual code for specific error patterns (e.g. off-by-one, unintended mutation, scope confusion).
  - Detected misconceptions are passed into the PlannerAgent so generated lessons *explicitly target the error*, not just the topic.
  - Pedagogical framing: this turns the curriculum from "topic-by-topic" into "fix-the-actual-misunderstanding," reinforcing Constructivism + Cognitive Apprenticeship from §7.
- Keep multi-language, peer-dialogues, mastery-graph in §9 untouched — those are still genuine future work.

### [ ] (Future, when shipped) Multi-language support
Leave in §9 for now. Promote when at least one non-Python language is supported end-to-end (planner prompts, code analyzer, designer animations).
