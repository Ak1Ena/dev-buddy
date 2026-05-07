# Lesson Content — Cinematic Visual Format

## Problem
The current explanation is a flat wall of paragraphs. Beginners need visual, step-by-step walkthroughs — not textbook prose.

## New Content Schema

Replace the `explanation` + `visualizations` fields with three structured sections:

```json
{
  "concept_hook": "Think of energy_budget like a bank account...",
  "animation_frames": [
    {
      "frame": 1,
      "title": "The Budget is Set",
      "code_state": "energy_budget = 10.0",
      "visual": "🔋 A glowing container labeled 'energy_budget' fills with the value 10.0",
      "narration": "Before the search even starts, we define the limit — how much energy is allowed."
    }
  ],
  "code_walkthrough": [
    {
      "code": "new_energy = energy_used + energy_cost",
      "plain_english": "Add the energy already spent to the cost of this step",
      "why": "We calculate the total BEFORE deciding whether this path is worth taking"
    }
  ],
  "key_concepts": ["energy budgeting", "comparison", "path pruning"],
  "workshops": [...],
  "summary": "Energy budgeting lets the algorithm skip paths that cost too much before wasting time on them."
}
```

## Component: AnimationPlayer

A cinematic frame-by-frame walkthrough component.

### Visual design per frame:
- **Header** — frame number + title, dark pill
- **Code state** — mini terminal showing the relevant 1-3 lines, highlighted
- **Visual** — light box with emoji + description of what the user should imagine
- **Narration** — large, prominent text (the "voice" explaining what's happening)
- **Navigation** — prev/next with dot indicators, optional auto-play

### Transitions:
- `AnimatePresence` with slide direction (forward = left-in, back = right-in)
- Smooth 300ms ease

## Component: CodeWalkthrough

Line-by-line explanation blocks.

### Per entry:
- Code snippet (syntax-highlighted, read-only Monaco or `<pre>`)
- "What happens" — plain English
- "Why" — reason/motivation in an amber callout

## Backend Changes (planner.py CONTENT_SYSTEM)

New prompt removes `explanation` and `visualizations`, adds `concept_hook`, `animation_frames`, `code_walkthrough`.

Rules for animation_frames:
- 4-7 frames per lesson
- Each frame = one atomic thing (one assignment, one comparison, one loop iteration)
- `code_state` = the 1-3 most relevant lines at that moment
- `visual` = emoji + what beginner should picture
- `narration` = one sentence, present tense, active voice

Rules for code_walkthrough:
- One entry per meaningful line/block
- `plain_english` = what it does
- `why` = why the programmer wrote it this way

## Backward Compatibility

Old lessons stored in DB have `explanation` + `visualizations`. The frontend checks:
- If `animation_frames` exists → new format → render AnimationPlayer + CodeWalkthrough
- Else if `explanation` exists → legacy format → render plain text paragraphs
- Neither → "content preparing" state

## Files to Change

| File | Change |
|---|---|
| `backend/app/agents/planner.py` | Rewrite `CONTENT_SYSTEM` |
| `frontend/src/components/lesson/AnimationPlayer.tsx` | New component |
| `frontend/src/pages/Learn.tsx` | Swap explanation section |
| `frontend/src/types/index.ts` | Add new content type fields |
