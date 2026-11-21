# Old UI design audit

Author: Lumi (Nexora Designer) · 2026-11-22 · read-only audit, no source changed.

## What I looked at

| App | Path | Stack | Look |
|---|---|---|---|
| **A** `frontend` | `dev-buddy/frontend` | React 18, Vite, Tailwind 3, Inter | Slate-navy, sky-blue accent, gradient text, glows |
| **B** `dev-buddy-ui` | `dev-buddy-ui` | React 19, Vite, Tailwind 4, Syne / DM Sans / JetBrains Mono | "Oracle Terminal": near-black, acid-lime accent, mono labels |

How the screenshots were taken: both apps run from **copies** in `/tmp` (source untouched) against a **copy** of `devbuddy.db`, with all AI keys blanked (no model calls, no cost). Logged in as the seeded `test` user. Chromium 1440×900 and 360×800. Files: `screenshots/old/<app>-<screen>-<desktop|mobile>.png` (`fe-` = app A, `ui-` = app B; `-full` = full page).

Not captured: **Assessment questions/results** and the **mentor chat with real replies**. Both need a live LLM call and I kept keys off. I only have the Assessment entry screen. App A has `SpaceDetail` and `Workshop`; app B has `Analytics`. Neither app has an AI-provider settings screen at all.

## Short verdict

The two apps are two different products wearing the same name. Both are dark, both lean on effects (glow, gradient, tiny mono caps) rather than structure, and neither is built around the loop Nexora needs: predict, try, get hinted, show evidence. The lesson screen is a dashboard with a chat bolted on. Progress is a completion bar. That's why it feels "not good": it's not only taste, the layout is answering the wrong question.

## Findings

### 1. Two design languages, no system
- A is blue/magenta with Inter; B is lime with Syne. Same brand name, different colours, type, nav, spacing. (`fe-dashboard-desktop.png` vs `ui-dashboard-desktop.png`)
- No tokens: colours are raw Tailwind classes (`slate-*`, `sky-*`) in A, hex in B. Dark only. No light theme.
- Fix: one token set, light and dark, in the proposal.

### 2. Decoration over information
- A landing: gradient headline ("See the logic."), glow blobs, grid texture, a pill saying **"Phase 3: Instant Logic Discovery"**. That's an internal project phase shown to users. (`fe-landing-desktop.png`)
- A lesson: "Logic Foundation" / "Logic Topology" with letter-spaced caps and icon boxes. The topology heading collides with its icon. (`fe-lesson-desktop.png`)
- Marketing tone ("cinematic mental models", "Oracle Terminal") doesn't match a learner who wants to understand one concept right now.

### 3. Text is too small and too faint
- ~89 places in A use 9–11 px text (`text-[10px]` etc.); B has 17 more. Mentor depth buttons read **QUE / CON / DIR / EXA** with no explanation. (`fe-lesson-desktop.png`, top right)
- Muted grey on near-black is used for things people need: the lesson-count line, dates, hint explanation, B's "Enter to send" line. The Assessment textarea placeholder and the disabled-looking primary button ("Analyze My Code", "Submit") are low contrast; the button looks off even when it's the main action. (`fe-assessment-desktop.png`, `fe-workshop-desktop.png`)
- I did not measure every pair. The new system targets 4.5:1 text and I give the numbers in `proposal.md`.

### 4. The lesson is not an active-learning space
- A lesson opens with a quote card and a diagram. The learner reads first. Nothing asks them to predict, run or explain before they are shown the answer. Workshop is a separate page behind a button. (`fe-lesson-desktop.png`, `fe-workshop-desktop.png`)
- B's lesson is a stepper with Play and Next. It's closer (code, step caption, progress dots) but the "Workshop" tab is locked and the page is crowded: header, amber banner, tabs, concept chips and the player share one band. (`ui-lesson-desktop.png`)
- The mentor panel is a blank right column at first ("AWAITING SOCRATIC INPUT", an empty brain icon). It takes 25% of the width and shows nothing until the learner types. The mentor reads as a chatbot, which the brief says it should not. (`fe-lesson-desktop.png`)

### 5. Progress and evidence are missing
- A: a % bar per space. "100%" on a space with 3 of 3 lessons just means *clicked through* (`fe-dashboard-desktop.png`). The brief says completion is not mastery.
- B: Analytics shows "Retention 0", "Hint Dependency 0.0", dashes for Avg Time and Lessons Done, and "Score: · Beginner" with no score on the dashboard. Zero-state looks broken. (`ui-analytics-desktop.png`, `ui-dashboard-desktop.png`)
- Nothing separates **assumed** from **verified** knowledge. No evidence list, no misconception view, no memory controls.
- The hint ladder (L0 to L3) is a real idea, but it's shown as a stat to minimise ("Aim for mostly L0"), not as part of the learner's own record. Fine as data, risky as a score: it could make people avoid asking for help. Open question for Nova and Sage.

### 6. The dashboard is a course catalogue
- A grid of "spaces" with language badges and progress bars (A) or a sidebar list plus a numbered lesson list (B). There is no "what's next and why". (`fe-dashboard-desktop.png`, `ui-dashboard-desktop.png`)
- Space names are repetitive ("Java 2", "Java 3", "Java 4", "Java 5") because the user has to create them manually.
- Lesson titles and content can mismatch the space: a JavaScript space contains "Data Types in your Regression Model" with a laundry analogy. That's content generation quality, not UI, but the UI offers no way to trust or question it.

### 7. Mobile (360 px)
- A dashboard: fine, a single column. A lesson: the AI Mentor drawer is **open on load and covers the whole lesson** in my capture (`fe-lesson-mobile.png`). I did not check whether that's the intended default; it's what a first visit shows.
- B lesson: the title is squeezed beside "Mark complete", the tab row is cut off after "Walkthrough" (Workshop is clipped), the Play row is below the fold. (`ui-lesson-mobile.png`)

### 8. Accessibility
- Little semantic support: ~48 `aria-`/focus rules across all of A, 2 `aria-` attributes in B. Many controls are icon-only. I did not run a keyboard or screen-reader test; this is a code grep plus screenshots.
- Colour carries meaning alone in places (green/orange language chips, red hint stat, lime "active").
- Heavy glow and pulse effects (`animate-pulse`, blur layers) with no `prefers-reduced-motion` handling that I could see.

### 9. What is worth keeping
- Step-through code with a caption and progress dots (B lesson). This is the right core interaction; it just needs "predict first".
- The hint ladder concept, with named levels (Think / Nudge / Point / Example).
- Code card with traffic-light header is fine as a code container but the dots are decoration and can go.
- A's mobile dashboard layout (single column, big tap targets).

## Priority for the redesign

1. One system with light and dark, readable sizes (≥ 14 px for UI, ≥ 12 px only for non-essential meta).
2. Lesson = a workspace: task first, mentor as a hint ladder you pull, not an empty chat.
3. Progress = evidence, with assumed vs verified.
4. Path with a reason ("why this next"), not a grid of courses.
5. A real AI provider settings screen (new; needed for BYOAI).
6. Calm: no gradients on text, no glows, no tracked mono caps as decoration.

## Open questions for Nova

- Should hint usage be shown to the learner as a score at all? (see §5)
- Do we keep the "space" concept (user-created, per language) or replace it with one role-driven path? The mock-ups use one role, Software Engineer, shown as a skill tree, and leave spaces out; easy to add back.
- Assessment length. I used "about 12 questions, stop any time" as a placeholder.
