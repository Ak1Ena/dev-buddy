# Lesson shapes and the story-trace template

Status: proposal, round 5. Author: Sage. Date: 2026-11-22. Design only, no code.
Inspiration: designedtoscale.app, seen only through two screenshots and Chief's notes (not opened, lessons not tested, terms not read). Builds on `learning-harness-pedagogy.md`, `first-domain.md`, `focus-and-live-mentor.md`, and D6, D17, D20, D22, D23 in `initial-decisions.md`. "Assumption" marks a choice with no Nexora data behind it.

**Idea:** a lesson is one realistic problem followed step by step: a picture builds up, a number grows, one change at a time. Our addition: the learner commits a guess before each reveal. Only those guesses and the check at the end count as evidence. Finishing the story proves nothing.

## 1. Pick the shape (D22)

Story-trace is the default only where there is a flow to follow. Every shape opens with a real-world story and ends with a check.

| Shape | Use when | Example | Main evidence |
|---|---|---|---|
| **Story-trace** | A process whose state changes step by step and can be replayed from stored data | loops, an HTTP request, a DB query | predict records, then the check |
| **Syntax drill** | Small rules to produce fluently, nothing to watch growing | syntax, naming, operators | apply on fresh variants, spaced |
| **Debugging hunt** | Search for a cause, no fixed path | `python.debugging`, `debug.isolate-reproduce` | bug fixed so a failing test passes (transfer) |
| **Design exercise** | Several answers can be right, no stored run to compare with | basic system design | explain, graded against a rubric (never the only record) |
| **Video-led** | The concept is mostly shown: a tool, an environment, an overview | using the terminal, reading a stack trace in an IDE | the predict and check after the video |

A story can still introduce a debugging or design lesson. Tiny concepts use a 4 to 5 step story-trace or one predict item.

**Video** is an optional block in any shape: at the start (a short intro) or inside one step. Rules: never the only way to learn the idea (a text version of the same step always exists); transcript and captions; no autoplay; 5 minutes or less (assumption; engagement falls with length, Guo 2014, from memory, unchecked); curated or ours, no embedding someone else's video without approval (open question 3). Watching gives no evidence. A video is always followed by a predict point and the check.

**Real-world story:** every lesson opens with 2 to 3 sentences about a situation a person could meet, with a name and a place. Curated, not freely LLM-written. Where it fits, a later case step goes back to the story.

**Authoring (D23):** AI drafts story, steps, predict questions and check items → a human reviews and may edit anything → publish. Nothing unapproved reaches learners. The approver's edited version is the published one. Reviewer checklist: story is realistic; every number comes from a stored run or is labelled "example numbers"; each predict question has one defensible answer; no Next label shows a pending value; check items differ from the predict questions; every visual has a text equivalent. Lessons are versioned. Editing a lesson never re-awards points.

## 2. Story-trace template

One lesson = one story = one concept (assumption). 6 to 10 steps.

| Part | Required? | What it must do |
|---|---|---|
| **Problem story** (step 1) | Required | The real-world story. Curated. |
| **Named steps** | Required | Names say what happens. Next previews the next name, never a value waiting to be predicted. Back always allowed. |
| **Predict points** | At least 3, and every case step | Learner commits a guess (or "not sure") before the reveal. Stepping on without one is allowed and earns nothing. |
| **Visualization** | Required | A view built up one step at a time, with replay and pause, over stored data (a real run for code, otherwise a labelled simulation). The LLM never writes its values. **2D for code (loops); 3D allowed for spatial systems (requests, servers, tables), because Aki asked for it (round 4).** 3D rules: a view over stored data only; every 3D element has a text or 2D equivalent (step name, metric strip); a reduced-motion version; readable at 390px; no state shown only in 3D. Engine is for Lumi and Arjun (the old one was removed in `1845c368`). |
| **Metric strip** | When the concept has a count or cost | Counts, not clock time. Simulated numbers say "example numbers". |
| **Case steps** (late) | At least 1 | Change one thing, predict first, then show the effect. |
| **"What changed"** | With each case step | One line, before → after, from the difference between two stored runs. |
| **Recap** | Required | Three plain sentences, curated. |
| **Check** | Required | Apply, explain, transfer per `first-domain.md`. No check, no lesson. |

**How our parts fuse in:**
- **Evidence:** a server-compared prediction with hint ≤ 1 is a `predict` record (`verified: true`), toward `in progress`, never the apply leg. A case-step prediction is `predict`, not transfer (Nova, round 4). Not evidence: watching, replay, video, reaching the recap. One miss changes nothing; two independent misses on the same misconception open review.
- **Mentor (text and live):** `FocusContext.viz_state.step_id` and `step_name`. Chip: "Asking about: step 4, inner loop". The mentor gets the current step only, never later values, and never states a pending prediction. Talk is never evidence.
- **Adaptivity:** skip to the check only when the concept is `verified`. `Assumed` runs the full story after a quick probe. After one miss, one smaller sub-step is offered (assumption). Every skip is logged.
- **Hints:** levels 0 to 3; hint 3 earns no credit.
- **Points:** see `points-and-levels.md`. Steps, predictions, video and finishing the story give none.

**Acceptance criteria**
1. No lesson reaches `verified` from story steps or video alone.
2. Every predict point is stored server-side before its reveal is sent.
3. A Next label never contains a pending value.
4. A wrong prediction shows nothing beyond the reveal and changes no state.
5. Every metric number is reproducible from stored data; simulated ones are labelled.
6. Skip is offered only when `verified`.
7. The mentor payload holds the current step only.
8. A video step has a text equivalent and is followed by a predict point.
9. Every 3D element has a text equivalent; a reduced-motion version exists.
10. A lesson has an approver and a version before it is visible.

## 3. Real lessons

Loops stays as built in mock A (10 steps: Guess, Two lists, First name, Inner loop, Next name, Whole run, More names, Both longer, Stop early, Recap; counts 9, 18, 36, 7, checked by running the code). Real-world wrapper to add: *Mai matches the party RSVP list against the ticket list and the script feels slow.* The two below are new and are to be built in 3D in the mock. Numbers are stored simulations, labelled "example numbers".

### B. "Why does Save sometimes fail?" (`web.http-basics`, then `sys.client-server`)

**Story:** Noi keeps a shopping list in a notes app on her phone. Most days Save works. On the train, sometimes a red "Couldn't save" appears and she cannot tell why.
**Scene (3D):** phone → server → database on a small map, a message travels between them. Mock server is a stored simulation, not a live network.
**Metric strip:** Messages sent · Database asked · Rows saved · Status code.
**Request used:** `POST /notes` with `{"title":"Groceries","text":"milk, eggs"}`.

| # | Step | Predict (one question) | Reveal | Msgs / DB / Rows / Status |
|---|---|---|---|---|
| 1 | The problem | Gut guess: where does Save break (phone, internet, server, database, not sure)? | Signal only; shown again at 10 | 0 / 0 / 0 / – |
| 2 | The Save button | Which method does Save use: GET, POST or DELETE? | POST, address `/notes`, body with title and text | 0 / 0 / 0 / – |
| 3 | Request reaches the server | What does the server read first to decide what to do: method and address, or body? | Method and address | 1 / 0 / 0 / – |
| 4 | Ask the database | Who talks to the database: the phone or the server? | The server; one query, one reply | 3 / 1 / 1 / – |
| 5 | Reply comes back | Which code family comes back for a good save: 2xx, 4xx or 5xx? | 2xx (201) | 4 / 1 / 1 / 201 |
| 6 | Case: wrong address (`/note`) | Which family comes back, and is the database asked? | 4xx (404); not asked | 2 / 0 / 0 / 404 |
| 7 | Case: missing title | Is the database asked before the server answers? | No; the server checks first, 400 | 2 / 0 / 0 / 400 |
| 8 | Case: database is down | Whose fault does the code say: 4xx (the request) or 5xx (the server)? | 5xx (500); one query sent, nothing saved | 4 / 1 / 0 / 500 |
| 9 | Case: no signal (the tunnel) | What status code does the server send back? | None. The server never got it; the phone shows its own error | 0 / 0 / 0 / none |
| 10 | Recap | None. Shows the step-1 guess and asks which of the four cases fits "sometimes" | Three sentences | – |

Evidence: predictions in 2 to 9 (`predict`). Check: apply (fix a request so the mock server accepts it: wrong path and missing field, auto-checked); explain (who owns 404, 400, 500 and "no code", rubric-graded); transfer (a new endpoint, `DELETE /notes/7`, with a new fault such as an unknown id or a missing login). Not sure a mock server fits the sandbox decision. Predicting a code family, not an exact number, avoids marking "200" wrong for a good save.

### C. "Why is one lookup slow in a big table?" (`backend.sql-basics`, or a later node)

**Story:** Pim runs a small online shop. Support types a customer's email into the admin page. It was instant with 200 customers; now with 200,000 it takes seconds. A phone book is sorted by name, but a list by sign-up date cannot be searched by email without reading every line.
**Scene (3D):** a stack of table rows with a row counter; a sorted index stack beside it later. A 12-row toy table is drawn; counts are modelled for 1,000 and 10,000 rows (label: "example numbers").
**Metric strip:** Rows examined · Index comparisons · Writes per insert.
**Query used:** `SELECT * FROM customers WHERE email = '…'`, email not marked unique, so every row is checked.

| # | Step | Predict (one question) | Reveal | Rows / Compar. / Writes |
|---|---|---|---|---|
| 1 | The slow page | Gut guess: why slower now (more customers, server, network, not sure)? | Signal only | – |
| 2 | The table | Is the table sorted by email? | No, by sign-up id | 0 / 0 / – |
| 3 | Lookup by id | How many rows are examined for id 640? | 1 (the id is the table's own order) | 1 / 10 / – |
| 4 | Lookup by email, no shortcut | How many rows are examined in the 1,000-row table? | All 1,000 | 1,000 / 0 / – |
| 5 | What an index is | Does the index hold full customers, or the email plus a pointer to the row? | Email plus pointer, kept sorted | – |
| 6 | Same lookup, indexed | About how many comparisons to find one email among 1,000 sorted: 10, 100 or 500? | 10, then 1 row | 1 / 10 / – |
| 7 | Case: 10× more customers | Scan goes from 1,000 to what, and the index from 10 to what? | 10,000 and 14 | 10,000 vs 1 / 14 / – |
| 8 | Case: add a customer | How many writes does one insert cost now (table plus email index)? | 2 (without the index: 1) | – / – / 2 |
| 9 | Case: search by city (no index) | How many rows are examined with 10,000 customers? | 10,000; the email index does not help | 10,000 / 0 / – |
| 10 | Recap | None | Three sentences | – |

Index comparisons are modelled with a sorted list (about log2 of the rows: 10 for 1,000, 14 for 10,000). Real databases use a tree with similar growth; the strip says so. Evidence: predictions in 2 to 9. Check: apply (given four queries, choose which column to index; auto-checked from the query plan, assumed possible in SQLite, to confirm); explain (why not index every column: each index adds a write); transfer (another table, such as orders by customer and by date). Not sure SQLite exposes rows examined cheaply; if not, counts stay modelled and labelled.

## 4. Not copied
Their text, story, step names, outline, isometric art, layout, colours, type, name. Whether our 3D art or wording sits too close is for Lumi and Nova to check.

## 5. Open questions
For Aki: (1) point values and level names, see `points-and-levels.md`; (2) video: ours, licensed, or linked from others? Default: ours or licensed, curated; (3) 3D scope: only spatial systems like HTTP and SQL, loops stay 2D (default).
For Arjun and Nova: 3D engine choice; mock server and toy table in the sandbox.
Not checked: the site beyond two screenshots, any Nexora learner data, SQLite plan output, whether this form teaches better than the current one. That needs a trial (controlled trial, `learning-harness-pedagogy.md`).
