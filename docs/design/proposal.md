# Round 3: Aki's "learn with us" mock as the base

*Added after round 2. Round 2 below stays as it was. Both mocks now share the same screens and flows; only the look differs. Files: `~/code/nexora-mock/notebook/` (A. Path, primary) and `~/code/nexora-mock/bench/` (B. Bench). Shared source: `~/code/nexora-mock/src/` (`python3 src/build.py` rebuilds both).*

## Recommendation

Go with **A. Path** (Notebook look). It is the closest to Aki's mock: white, royal blue, a serif for headings, a handwritten buddy note. Bench is kept as the second direction with the same screens, in a denser, mono, amber-on-dark-teal look. No third direction.

## What changed

- New shared screens in both: Home, Dream job, First check, Skill map (Map | Step by step), Lesson with editor and visualization, Live mentor panel, Progress, Settings.
- Adapted for the Software Engineer (modern) path from Sage's skill model: 35 skills, 8 with Python lessons today, 27 shown as "not in Nexora yet". States and counts follow the model (met of total, never a percent, never "ready").
- "4 skills away" is now "2 of 35 skills with evidence". Nothing says "ready for the job".
- Points and levels move only on verified evidence. The lesson check gives "+40 for passing the loops check", and the text says "Points move only when a check passes".
- Courses page dropped (Nexora is not a course catalogue). "Picked for you" is the next path steps, each with why it comes next and what is still missing.
- Settings has two separate cards: text mentor and live mentor, each with its own provider, model and status.
- Fonts bundled (Fraunces, Inter, Caveat for A; IBM Plex for B), licences in `notebook/fonts/`. No network at runtime.

## Aki's mock to Nexora, screen by screen

| Aki's mock | Nexora screen | What I did |
|---|---|---|
| Home: greeting, continue, "just talk to my buddy", buddy note, "Picked for you" | Home | Kept the structure. The talk button shows only when a live mentor is set up. "Picked for you" = next path steps with why each is next. |
| "I want to be a ___" | Dream job | Software Engineer is filled. Other careers are greyed, "Coming later". A free-text box is disabled. |
| Skill tree with have / learning / locked | My path, Map | Tiers bottom-up. State is an icon plus a word, never colour alone. Numbered badges mark the next picks. |
| Skill side panel, "skill level n of 5" | Side panel | Level replaced by "evidence n of m". Shows what it is, evidence so far, still missing, how to learn it. |
| "Where else your skills can take you" | Same section | Four later branches (Frontend, Backend, Data, ML) with how many core skills carry over. |
| Lesson: video + editor | Lesson | Video replaced by an interactive trace. Predict, watch it run, write one. Focus chip shows "Asking about: line 4". |
| Lesson with live buddy (ref 4): handwritten "your buddy sees this" above a dashed outline, "Your AI buddy" with a Live status, eye note, "Share my whole screen" toggle, chat bubbles | Lesson + buddy panel, Live | A. Path copies this look: Caveat label on the outline, blue user bubbles and grey buddy bubbles. B. Bench keeps its mono captions with a left border. Video is replaced by the interactive trace; Aki's "Handy when you practice in Canva or Excel" is replaced by a plain can/can't-see text, since Nexora's lessons are code. |
| Live panel | Buddy panel, Live | "Live" status, a dashed outline on "your buddy sees this", share whole screen **off** by default, plain text on what it can and cannot see. |
| Avatar / settings | Settings | Two provider cards. |

## Round 3 fixes (after Ella's review)

Both mocks, rebuilt. Source of each finding: `~/code/nexora-mock/review/FINDINGS.md`.

- **Stage labels** on the map sit above each row, no longer beside it, so they can't hit node labels or connectors. They are renamed to describe skill order, not readiness: Start here, Then, After that, Further on, Later ("Nearly there" is gone).
- **Node tap at 390** scrolls to the panel and the panel has a "Back to the map" button. (Checked: scroll lands on the panel, back returns to the map.)
- **"Asking about" chip** is inline under the code, so it no longer covers the answer options. A sticky bar stays only for a live call at 390.
- **Header:** the points chip is a button that explains points; the theme toggle has a proper label.
- **Legend** footnote has space above it.
- **Live panel:** "Live" appears once in the call pill; the header says "On a call · Gemini". Chat bubbles trimmed (A. Path bubbles, B. Bench captions).
- **Settings:** both Test connection buttons are now secondary (no primary on the page); "Open the lesson" sits on its own row.
- **Bench:** the Lesson / Buddy switch shows a filled selected segment. Yellow is for actions only: the buddy note is plain text with a neutral left border, and the progress bar is teal.
- **Quick nice-to-have:** the Mock-up jump bar is collapsed by default.
- **Not done:** grouping evidence rows by skill at 390, and a thicker dashed highlight in Bench. Left for later.

Check: route script at 1280 and 390 in both mocks, no console errors, no sideways overflow.

---

## Open questions for Nova and Sage

1. **Points and levels** are not in Sage's model. The mock uses "Level 2, Explorer", 120 of 200 points, +40 for the loops check. Keep, change, or drop?
2. **Courses** dropped on purpose. Confirm.
3. **Role pick at onboarding.** Only Software Engineer is real. The other four names are mine.
4. **Live button default.** The demo has a live mentor set up. Removing it in Settings hides the talk buttons (checked).
5. **Placeholder data**: the name "Sam", provider names, key tails.

## What I could not check or had to guess

- Not opened or only guessed from the two screenshots: the avatar menu, dark toggle behaviour, the other example careers, custom job typing, Courses filters, the lesson chapter list, Aki's mobile layout, the "also learning" node interaction.
- Evidence is headless Chromium screenshots (desktop 1280 and 390 px, light; dark on desktop) in each mock's `screenshots/r3-*.png`, plus a script that opens every route, every map node, the check, the live toggle and checks for horizontal overflow and console errors (none found). No video, no screen-reader test, no real device.

---

# Nexora design proposal, round 2 (Notebook and Bench)

Author: Lumi (Nexora Designer), 2026-11-22, for Nova and Aki. No app source changed. Sample data only: every state, count and sentence in the mock-ups is made up for the demo. The 35-node tree and node names follow Sage's `docs/product/skill-career-path-model.md` §2.

Round 1 had two directions (Studio, Console). After reading Anthropic's `frontend-design` SKILL.md I checked them against its list of generic defaults, found I had fallen into several, and rebuilt both. Studio and Console are gone. The product logic, copy rules and screens are unchanged; the look, type, layout and chrome are new.

## The short version

Open either file in a browser. No server, no network (fonts are bundled).

| | A. Notebook | B. Bench |
|---|---|---|
| File | `/home/akiena/code/nexora-mock/notebook/index.html` | `/home/akiena/code/nexora-mock/bench/index.html` |
| Feel | A study notebook. Light first, quiet, serif reading text, a highlighter marks what to do now. | A workbench. Dark first, dense, panes, one gauge always in view. |
| The one memorable thing | The yellow highlighter. It marks only "do this next": the current nav item, step 1 of the plan, the next node on the skill tree. | The ledger strip in the top bar on every screen: "2 of 35 evidenced", a four-part bar, "8 in Nexora". |
| Type | Literata (reading, headings) + Atkinson Hyperlegible Next (interface) + Atkinson Hyperlegible Mono (code) | IBM Plex Sans (everything) + IBM Plex Mono (code only) |
| Nav | Left sidebar (desktop), bottom tabs (360 px) | Top bar with underline tab (desktop), Menu button (360 px) |
| Skill tree | Vertical, top down | Horizontal, left to right |
| Lesson | Task cards in a column, mentor as margin notes beside them. On 360 px a Task / Mentor switch. | Steps rail, task, mentor pane. On 360 px the mentor opens as a bottom sheet. |
| Shape | Flat sections on the page; cards only where something is a task or a detail. Pill buttons. | Panes with 6 px corners, 4 px on small parts. |

**Recommendation: A, Notebook.** The brief is focus and active learning for people who are often beginners, and long reading (why this next, what is still missing, hint text) is easier in a serif on a calm page. Bench is the better pick if Aki wants it to feel like a developer tool, and its always-visible count strip is a real advantage for the honest "2 of 35" message. This is a taste call, so it is Aki's.

Screenshots: `docs/design/screenshots/new/notebook/` and `.../bench/` (also in each mock's `screenshots/` folder). Names are `<screen>-<desktop|mobile>-<light|dark>.png`. Screens: start, assess-1, assess-result, path, path-node-loops, lesson-start, lesson-working, lesson-working-full (desktop), lesson-mentor (mobile), progress, settings, settings-connected. The non-default theme has start, path, lesson-start, progress and settings.

## How each direction applies the frontend-design skill

I followed the skill's process: a plan, a review of the plan against the generic defaults, then the build, then a screenshot critique.

**Subject, audience, job** (from the brief; no change needed): an AI-agnostic adaptive learning platform for technical learners, who want to get good at software engineering by doing, with evidence of what they can do. The vernacular I drew on: lab notebooks, worked examples, code margins, ledgers and gauges.

### Plan, direction A (Notebook)

- Colour: paper `#F5F7F5` (a cool grey-green, not cream), ink `#18202B`, ultramarine `#1E3A9E` for action, highlighter `#F7E08B` for "now", field-grey `#E8ECE9`.
- Type: Literata for headings and reading text (serif, line-height 1.65), Atkinson Hyperlegible Next for buttons, labels, chips and tables, Atkinson Hyperlegible Mono for code. Atkinson was designed for low-vision legibility, which suits a learning product.
- Layout: left-aligned, one reading column about 62 characters wide, margin notes to the side.

```
Notebook, lesson (desktop)
+------+-----------------------------+--------------+
| nav  |  Loops: predict, then watch |  | Mentor     |
|      |  [1] Predict   (card)       |  | Level 0 .. |
|      |  [2] Trace it  (card)       |  | Level 1 .. |
|      |  [3] Write one (card)       |  | [A bigger  |
|      |                             |  |  hint]     |
+------+-----------------------------+--------------+
```

### Plan, direction B (Bench)

- Colour: slate-teal base `#0E1A1F` (dark) / `#EAF0EF` (light), panes `#15262D` / `#FFFFFF`, text `#E4EEF0` / `#0F2227`, amber `#F2C14E` (dark) / `#7A4E00` (light) for action and "now".
- Type: IBM Plex Sans throughout at 15 px, IBM Plex Mono for code only.
- Layout: left-aligned panes on a grid, a persistent strip in the top bar, mentor as its own pane.

```
Bench, lesson (desktop)
+-------------------------------------------------+
| Nexora  Today Path [Lesson] ..  [2 of 35 |bar| ] |
+--------+------------------------+---------------+
| steps  |  [1] Predict           |  Mentor pane  |
| 1 2 3 4|  [2] Trace it          |  hint ladder  |
|        |  [3] Write one         |  ask box      |
+--------+------------------------+---------------+
```

### Review against the generic defaults, and what I changed

I held my round-1 build against the skill's five clusters.

| Default in the skill | Round 1 | Now |
|---|---|---|
| Cream background with a serif and a clay accent | Studio had warm cream `#FAF7F2` | Notebook uses a cool grey-green paper, and the serif is used for reading, not as a showy display face. Accent is ultramarine, not clay. |
| Near-black with a single bright accent | Console was near-black `#0F1217` with a blue accent | Bench is slate-teal, not near-black, and the accent is amber that flips to a dark brown in light mode so it keeps contrast. |
| Identical rounded cards, one radius, soft shadow, everywhere | Both | Notebook: most sections are flat on the page, radius varies by role (6 / 8 / 14), no shadows. Bench: panes are tight (6 / 4) with borders only, no shadows. |
| Tracked caps eyebrow above headings | Used a small label above many headings | Removed from every screen. |
| Middle-dot meta strings, arrows on buttons, mono for small labels, spaced em dashes | All present | Commas, colons and plain sentences. No arrows on buttons. Chips and labels are in the sans. Mono is for code only. |
| Numbered markers on non-sequences | Numbered where it was a real sequence | Numbers only on real sequences: the lesson steps and the "next steps" plan. |

What is still a judgement call: Bench's panes are closer to the "card kit" than Notebook's flat layout; I kept them because a dense tool needs bounded regions, and I varied radius and dropped shadows. Both directions still use rounded pill chips for skill states, because the state chip carries icon + word and needs to read as one object.

### Memorable element and restraint

Each direction spends its boldness in one place (highlighter for A, ledger strip for B). Everything else is quiet: no gradients, no glow, no pulse, no decorative illustration. The only motion is the mobile mentor sheet in Bench (about 250 ms, answers the person tapping Mentor) and toasts. All of it is off under `prefers-reduced-motion`. I did not add a page-load animation; the skill allows one and I judged this product does not need it.

### Copy

Written from the learner's side, in sentence case, active verbs, no filler. "Start", "Open the skill map", "Do the placement", "Lock in my prediction", "Test connection". The same action keeps the same name along the flow. Empty or missing content says what it is: "Not in Nexora yet. On the map, no content yet." and that it is "the product's gap, not yours".

## What changed from the old UI, and why

From `audit.md`: two unrelated apps, dark only, tiny low-contrast text, a lesson that is a reading page with a chat bolted on, a progress bar that means "clicked through". So:

1. **One system, light and dark.** Tokens, not raw colours. Both themes are in each mock; use the Theme button. Choice is saved per direction in the browser.
2. **Lesson is a workspace, not a page to read.** Predict first, then step through a real run, then write one. The mentor is a hint ladder you pull (Level 0 Question, 1 Nudge, 2 Point, 3 Worked example) with a plain note on what each level costs. A chat box sits under it, secondary.
3. **Progress is evidence.** Each skill has a state with a name and a shape. The evidence table says what you did, how it was checked and whether it counts.
4. **Assumed is never shown as known.** Dashed outline and the word "Assumed". Never counted as met.
5. **A path with a reason.** Up to 3 next steps, each with "Why this?" and what evidence is missing. The first step is the primary action. Not a catalogue.
6. **A real AI-provider settings screen,** new, needed for bring-your-own AI.

## Design system

### Type

| Role | Notebook | Bench | Notes |
|---|---|---|---|
| Body | Literata 17 / 1.65 (16.5 on 360 px) | IBM Plex Sans 15 / 1.5 | Nothing a learner needs is below 14 |
| Meta (hints, notes) | Atkinson 14 | Plex 14 | Still 4.5:1 or better |
| Page title (h1) | Literata 800, 30 to 44 fluid | Plex 650, 23 to 30 fluid | Left aligned, line length under 62 ch (A) and 80 ch (B) |
| Section title (h2) | Literata 700, 24 | Plex 650, 16 | |
| Code | Atkinson Mono, 14 to 15 | Plex Mono, 14 to 15 | Line numbers on the trace |

Fonts are self-hosted OFL woff2 files in `fonts/` next to each `index.html` (licence text is there too), so the mock works offline. Thai falls back to Noto Serif Thai or Noto Sans Thai, then the system face; none of these fonts cover Thai, so a Thai pass is needed before Thai content ships (open question 11).

### Colour tokens

WCAG 2.x contrast computed on the final token values with a small script. Targets: text 4.5:1, borders and focus ring 3:1. These are token-pair checks, not an automated scan of every rendered element (see "Not tested").

Notebook:

| Token | Light | Dark |
|---|---|---|
| `bg` / `surface` / `surface2` | #F5F7F5 / #FFFFFF / #E8ECE9 | #131A26 / #1B2433 / #243044 |
| `ink` on bg | #18202B (15.2) | #E9EDF5 (14.9) |
| `muted` on bg | #4B5565 (7.0) | #AAB4C5 (8.4) |
| `accent` (text on surface) | #1E3A9E (9.8) | #9DB4FF (7.7) |
| button text on accent | #FFFFFF (9.8) | #0F1A3D (8.4) |
| `mark` (highlighter), ink on it | #F7E08B (12.5) | #4A4012 (8.8) |
| `ok` / `warn` / `info` / `bad` on surface | #1F6B3F / #8A4B00 / #1E4F8F / #A32323 (6.5 to 8.2) | #74D39A / #E8B25A / #8FB6F0 / #F29090 (6.8 to 8.6) |
| `line-strong` on bg / surface | #76827D (3.7 / 4.0) | #7C8AA3 (5.0 / 4.5) |
| `focus` ring on bg / surface | #B3400A (5.3 / 5.8) | #FFD166 (12.1 / 10.8) |

Bench:

| Token | Light | Dark |
|---|---|---|
| `bg` / `surface` / `surface2` | #EAF0EF / #FFFFFF / #DCE7E6 | #0E1A1F / #15262D / #1C3139 |
| `ink` on bg | #0F2227 (14.2) | #E4EEF0 (15.0) |
| `muted` on bg | #44585E (6.5) | #9FB3B8 (8.1) |
| `accent` (text on surface) | #7A4E00 (7.2) | #F2C14E (9.3) |
| button text on accent | #FFFFFF (7.2) | #1B1503 (10.8) |
| `accent-soft` with ink on it | #F8EBC8 (13.9) | #2B2A16 (12.3) |
| `ok` / `warn` / `info` / `bad` on surface | #17663A / #A33A1F / #0B5D78 / #A12D2D (6.6 to 7.4) | #6FD6A0 / #FF9F86 / #7FCFE8 / #FF8A8A (6.9 to 8.9) |
| `line-strong` on bg / surface | #66808A (3.6 / 4.2) | #6F8A92 (4.8 / 4.3) |
| `focus` ring on bg / surface | #0F2227 (14.2 / 16.4) | #FFFFFF (17.7 / 15.6) |

Rules, same in both:
- **Colour never carries meaning alone.** Each skill state has its own icon shape, a word, and a border style (solid or dashed).
- Accent means "act here" and "this is where you are". Green only for evidence that holds. Amber/orange only for "needs your attention", never for "bad". In Notebook the highlighter means only "do this next".

### Spacing, shape, motion

- Spacing scale 4, 8, 12, 16, 24, 32, 48. Notebook is roomy (sections 44 px apart), Bench is tight (16 px gaps between panes).
- Radius: Notebook 6 (small parts), 8 (nodes), 14 (task cards); Bench 4 and 6. No shadows, except the Bench mobile sheet.
- Touch targets at least 44 px (buttons, tabs, strip, radio rows 48 px).
- Focus: 3 px solid outline, 2 px offset, always visible. Screen headings take programmatic focus on navigation without a ring.
- Motion: only the Bench mentor sheet (250 ms) and toasts; off under `prefers-reduced-motion`.

### Skill states (shared by both)

| State | Meaning | Shape and border | Counts as met? |
|---|---|---|---|
| Verified | Shown, not just said | Filled circle with tick, solid | Yes |
| Retained | Still holds after time away | Filled diamond with tick, solid | Yes |
| In progress | Some evidence, rule not met yet | Half-filled circle, solid | No |
| Needs review | Quick check due | Circular arrow, solid | Not in the "met" count while the review is due (Sage to confirm, question 2) |
| Assumed (you said / we guess) | Self-report or a guess | Dashed circle, dashed border | **No** |
| Assumed gap | We think it is a gap | Dashed circle with ?, dashed | No |
| Locked | Needs an earlier skill. Soft: you can skip in | Padlock | No |
| Not in Nexora yet | On the role map, no content | Dashed line, dashed border | No, and not a gap you caused |
| Later | Optional branch | Dashed | Not counted unless you add it |

### Components (all in both mocks)

Buttons (primary, default, ghost, 44 px), chips (state, with icon), counts bar and legend, the ledger strip (Bench top bar), skill-tree node and detail panel, "why next" step, concept row, evidence table (restacks on 360 px), predict block, step-through trace, hint ladder, chat, placement question, provider form, toast, nav.

## Core flows and why they look like this

**Today (start).** Three next steps with reasons, "where you stand" and the placement. A returning learner sees what to do, not a catalogue. Step 1 is the primary action.

**Placement (onboarding and assessment).** One question per screen, always "I'm not sure" and "Stop here". The result says "assumed" and shows no score or level label. About 10 items is my placeholder (the mock shows 3).

**Career path (the skill tree).** One role: Software Engineer. Python fundamentals and Debugging are shown in full (the 8 skills Nexora really teaches, with prerequisite edges, the next 3 steps numbered on the nodes). The other 27 core skills are in 8 collapsible areas marked "Not in Nexora yet". The four optional branches (Frontend, Backend, Data, ML, 3 skills each) are marked "Later".
- The counts read "2 of 35 core skills evidenced", then "Nexora teaches 8 of the 35 so far. The other 27 are on the map and not built yet. That's the product's gap, not yours." The bar has four patterned segments: met, assumed (hatched, not counted), in Nexora but not met, not in Nexora yet (empty outline, so it reads as "not built", not "failed").
- Wording is "skills evidenced for this role", never "ready" or "% complete".
- Select a node: the panel shows the depth the role asks for, prerequisites, evidence so far, evidence still needed, and for locked skills the soft-lock choice (take a short check, or skip in with no state change).

**Lesson (the interactive space).** Predict, then trace, then (not mocked) write one and explain. The trace stays locked until you commit to a prediction or say "I'm not sure". A miss says "Step through to see where it differs", gives no answer, and says it changes nothing in the path. The mentor has the hint ladder first and a chat second.

**Progress and evidence.** Skill list with states, then an evidence table: what, result, hint level, source, whether it counts. AI-graded and self-reported lines say plainly that they count once or not at all. Misconception notes can be removed by the learner. Memory controls (see, correct, export, delete) are buttons that only toast in the mock.

**AI provider settings.** Provider list (OpenAI, Anthropic, Gemini, OpenRouter, Ollama, LM Studio, vLLM, custom OpenAI-compatible), key or endpoint as needed, test connection, model picker after a test, failure behaviour, and a line that learner memory stays with Nexora if they switch. Mock only: nothing is stored or sent. Don't paste a real key.

## Accessibility: what I did and what I tested

Done in the build: landmarks and headings, a skip link, one `h1` per screen that takes focus on navigation, `aria-current` on nav and the current step, `aria-live` for results, the trace caption and toasts, each state with icon + word, 44 px targets, visible focus, reduced motion, tables that restack on 360 px, the strip link carries a full-sentence label for screen readers.

Tested (Chromium via Playwright, my own runs, 2026-11-22):
- All six screens load with no console or page errors, in both directions, at 1440 and 360 px, light and dark (8 runs, all clean).
- No horizontal overflow at 360 px or 1440 px on any screen in those runs.
- Contrast: every token pair in the tables above computed; all text pairs are 4.5:1 or better and borders and focus rings 3:1 or better.
- Keyboard: from the top of the path page, Tab reaches the "Loops" node in 12 presses with a solid 3 px outline; Enter opens its detail and moves focus to the heading. On the lesson, Space selects an option, Tab goes to "Lock in", Enter unlocks the trace and moves focus to the result. Same in both directions.
- Visual check of the screenshots at both widths (found and fixed: first step was not the primary button, state labels were lowercasing "Nexora", the Bench top bar overlapped at 360 px).

**Not tested:** screen reader output (NVDA, VoiceOver), Firefox and Safari, a real phone, zoom to 200%, high-contrast mode, an automated axe-style scan of every rendered element (Ella's audit may cover it), text over the hatched count bar patterns. Disabled buttons are washed out on purpose and exempt from the contrast rule. Treat the claim as "built to the rules, tokens checked, keyboard path checked", not audited.

## What is not designed yet

- Writing a loop in an editor (lesson step 3) and "explain in your own words" (step 4). The editor is a build decision.
- Empty and first-run states beyond the placement. Error and offline states for the mentor.
- Thai text (see fonts). Desktop app (later).
- Hover or long-press help for the hint levels on 360 px.

## Open questions

For Nova (and Sage where it is about the model):

1. **Hint use as a score?** I show hints as costs on what an item can *count for* and say "asking is not penalised". No hint "score" anywhere. OK?
2. **Needs review and the count.** In the mock a skill due for review drops out of "met" until the review is done. Is that Sage's rule, or does it stay met?
3. **Spaces.** The old app has user-created spaces per language. I dropped them: one role, one tree. Do we need them back?
4. **Placement length.** "About 10 questions, stop any time" is my placeholder.
5. **Placement result.** It lists the skills it touched and leaves the rest unknown. Should it also create "assumed" states for skills it did not ask about? I chose no.
6. **Role depth labels** (familiar, working, solid) are placeholders from Sage's notes; the text says "to be set by a person".
7. **AI-tools area.** Described as "built around planted flaws, usage never scored". Wording is mine, please check with Sage.
8. **Provider fallback** ("Try my fallback provider") is my idea, not in the brief. Keep or cut?
9. **Memory controls** (see, correct, export, delete) come from the brief's evidence-and-memory idea; confirm the set.
10. **Which direction?** Notebook or Bench. For Aki.
11. **Thai.** Aki writes in Thai. Is Thai UI text in scope? If yes, I need to pick Thai-capable faces (for example Noto Sans Thai and Noto Serif Thai) and re-check line height.

## What I could not check

- Old Assessment questions and result screens, and real mentor replies: they need a live model and I kept keys off. I only captured the entry screens.
- The old apps have no AI-provider settings screen, so there is nothing to compare.
- I did not run keyboard or screen-reader tests on the old apps (audit is code grep plus screenshots) or measure the old contrast pairs.
- No user testing with a real learner. Everything here is a designer's judgment.
- I did not install any other skill or plugin; the frontend-design SKILL.md was the only one used.
