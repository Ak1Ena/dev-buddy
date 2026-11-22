# Standard lesson template: story trace

Status: proposal. Author: Sage. Date: 2026-11-22. Design only, no code.
Inspiration: designedtoscale.app. Aki: "adapt that teaching method to ours". I saw the site only through two screenshots and Chief's notes. I did not open it, did not check whether its lessons test the learner, and did not read its terms. Builds on `learning-harness-pedagogy.md`, `first-domain.md`, `focus-and-live-mentor.md`, `skill-career-path-model.md`, and D6, D17, D20 in `initial-decisions.md`. "Assumption" marks a choice with no Nexora data behind it.

**Idea:** a lesson is one realistic problem, followed step by step. A picture builds up, a number grows, one change is shown at a time. Our addition: the learner commits a guess before each reveal, and only those guesses and the check at the end count as evidence. Finishing the story proves nothing.

## 1. The template

One lesson = one story = one concept (assumption). 6 to 10 steps; a small concept may use 4 to 5.

| Part | Required? | What it must do |
|---|---|---|
| **Problem story** (step 1, tagged PROBLEM) | Required | One concrete situation a learner could meet ("my script feels slow", "Save fails sometimes"). Curated text, not LLM-written. |
| **Named steps** | Required | Short names that say what happens ("Inner loop"). The Next button previews the next name, never a value waiting to be predicted. Back is always allowed. |
| **Predict points** | Required: at least 3, and every case step | The learner commits a guess (or "I'm not sure") before the reveal. Stepping on without committing is allowed and earns nothing. |
| **Visualization** | Required | The trace stepper (`focus-and-live-mentor.md` §2) or another 2D view built up one step at a time, with replay and pause. It shows stored data (a real run where code is involved, otherwise a labelled simulation). The LLM never writes its values. 2D only. |
| **Metric strip** | Required when the concept has a count or cost; otherwise a state panel instead | Numbers filling in as steps advance, so the learner sees the effect grow. Use counts (turns, comparisons, round trips, rows) over clock time, which is not repeatable. Simulated numbers carry an "example numbers" label. |
| **Case steps** (late) | Required: at least 1 | Change one thing, ask for a prediction first, then show the effect. |
| **"What changed"** | Required with each case step | One line per change, before → after, generated from the difference between two stored runs. |
| **Key idea** | Optional | One curated sentence per step. Not an LLM summary. |
| **"Seen" list** (their "You'll learn" ticks) | Optional | If shown, it says "seen" and sits apart from the concept's real state, so a ticked box never looks like `verified`. |
| **Recap** | Required | Three plain sentences from the curators. Shown after the last step. |
| **Check** | Required | The tasks that make evidence: apply (write or fix, passes tests), explain (own words, rubric-graded), transfer (new-looking problem), per `first-domain.md`. A lesson without a check is an explainer, not a lesson. |

## 2. How our parts fuse with it

| Our part | How it works inside the template |
|---|---|
| **Predict before step** | Each predict point goes to the server before the reveal and is compared with the stored data (D6). The server records the result. A prediction it never saw is context only. |
| **Evidence** | A server-compared prediction with hint ≤ 1 is a `predict` record, `verified: true`, toward `in progress`. It is never the apply leg. Whether a case-step prediction may count as the transfer leg is open question 4 in the focus doc. I do not change the rule here. Not evidence: watching, replay, reaching the recap, ticks. One miss changes nothing. Two independent misses on the same misconception open review. |
| **Focus-aware mentor (text and live)** | `FocusContext.viz_state.state` carries the step id and name (field names are mine, for Nova and Arjun to settle). The chip reads "Asking about: step 4, inner loop". The mentor aims its question at that step. It never states a pending prediction. Hint levels do not change because of focus. The live model gets only the current step, never later values, so it cannot read them out. This needs no screen frame, which fits D17. Talk is never evidence. |
| **Adaptivity** | By verified knowledge only. If the concept is `verified`, offer "skip to the check" and let the learner choose. If it is only `assumed`, the full story runs, opening with a quick probe. After one wrong prediction, offer one smaller sub-step on the same point (assumption). It changes no state and no path. Two independent misses use the existing prerequisite rules. Every skip or zoom is logged with its reason and records. |
| **Hints** | Levels 0 to 3 as now. Hint 3 shows a worked example for a similar case and earns no credit. |
| **Points (D20)** | Points move only when the check changes a concept's state (a passed check, a retained skill). Steps, predictions and finishing the story give none. The UI says why points moved. Values and level names are not decided. |
| **Skill** | A new teaching skill candidate, `story-trace-lesson`, built on `trace-prediction-questioning`. It goes through the normal proposal and trial flow. |

### Acceptance criteria (the template, not one lesson)
1. No lesson can reach `verified` from story steps alone.
2. Every predict point is stored server-side before its reveal is sent.
3. A Next label never contains a pending value.
4. A wrong prediction shows no answer text beyond the reveal itself, and changes no state.
5. Every metric-strip number is reproducible from stored data. Simulated ones are labelled.
6. A skip is offered only when the concept is `verified`, never when `assumed`.
7. The mentor payload holds the current step only. No later values.
8. The "seen" list, if shown, never uses the verified style.

## 3. When the template does not fit

- **No process to trace.** Vocabulary, syntax rules and naming conventions have nothing to watch growing. Use a short predict-and-check item instead.
- **Open-ended hunting.** `python.debugging` and `debug.isolate-reproduce` are search tasks. A fixed step list suggests a straight path that real bugs do not have. Use a bug hunt with a failing test. A story can still introduce it.
- **Planted-flaw review** (`ai.review-output`) is a task, not a trace. It keeps its own shape from `skill-career-path-model.md`.
- **Design judgement** (basic system design, "familiar" depth): many answers can be right, and there is no stored run to compare a prediction with.
- **Tiny concepts** (variables): use the 4 to 5 step form, or a single predict item.
- **Learner-written code** cannot be traced from stored data. Only curated programs have stored runs (open sandbox question in `first-domain.md`).
- **Cost.** Each lesson needs a curated story, a verified run or model, and a check set. Only 8 Python concepts are real in v1. Passive watching can feel like learning, which is exactly why steps earn no credit.
- **Effect not known.** I have no Nexora data that this form teaches better. The support I know of is for tracing before writing (Lister 2004) and the notional machine (Sorva 2013), not for this exact form. Both are from memory, not re-checked. A trial against the current lesson format is the way to know.

## 4. Three example outlines

Only the first is a real node today. The others (not in Nexora yet) show the template holds outside Python. Their node placement is my guess.

### A. Python loops: "Why is my loop slow?" (`python.loops`)

Story: a script matching two name lists feels slow. Counting how many times the body runs, not big-O (complexity is out of scope in `first-domain.md`). Program, 3 names against 3:

```python
mine = ["ann", "bo", "cy"]
theirs = ["cy", "dee", "ann"]
for a in mine:
    for b in theirs:
        if a == b:
            print(a)
```

Real run: 9 comparisons, prints `ann` then `cy`. Metric strip: outer turns, comparisons, prints.

| # | Step | Learner does | Record |
|---|---|---|---|
| 1 | Guess | Reads story and code, guesses the comparisons for 3×3 | Signal only |
| 2 | Two lists | Watches the variables fill | None |
| 3 | First name | Predicts `a` and the first `b` | `predict` |
| 4 | Inner loop | Predicts how often the `if` runs for `"ann"`, and when `print` fires | `predict` |
| 5 | Next name | Predicts where the inner loop restarts for `"bo"` | `predict`, misconception tag if it "carries on" |
| 6 | Whole run | Predicts the total, sees 9 | `predict` |
| 7 | More names | Predicts the count with 6 names in `theirs`; sees 9 → 18 | `predict` |
| 8 | Both longer | Predicts for 6 and 6; sees 36 | `predict` |
| 9 | Stop early | Predicts the count when the inner loop stops at a match; sees 7 | `predict` |
| 10 | Recap | Three sentences, then the check | None |

Check: write a loop that counts matches (apply); say why 3×3 runs 9 times (explain); a new-looking problem with the same shape (transfer). Doubling `theirs` as `theirs + theirs` repeats names, so a curated version should use new names. Counts 9, 18, 36 and 7 were checked by running the code. Step 9 needs `break`, which `first-domain.md` does not name; I'm not sure it is in the loops node. Fallback story: "Why does my loop print one too many?" (`range` off-by-one).

### B. How a request travels: "Why does Save sometimes fail?" (`web.http-basics`, then `sys.client-server`)

Story: a small notes app. Pressing Save sometimes shows "failed". Where along the way did it break? (A different angle from a slow page, on purpose.)

| # | Step | Predict point |
|---|---|---|
| 1 | Problem | None |
| 2 | The button | What the browser sends: method, address, body |
| 3 | Find the server | None (watching) |
| 4 | Request arrives | Which part of the request the server reads first |
| 5 | Ask the database | None |
| 6 | Reply goes back | The status code of a good save |
| 7 | Case: wrong address | Predict the code (404) |
| 8 | Case: missing field | Predict the code (400) |
| 9 | Case: server crashes | Predict the code (500) |
| 10 | Recap | None |

Metric strip: hops reached (browser → server → database → back), status code. Counts only. The run is a stored **simulation** of a mock server, labelled as such, not a live network. Evidence: the case predictions. Check: fix a request so a mock server accepts it (apply, tests); explain which side owns each code; a new endpoint with a new fault (transfer). Not sure a mock server fits the sandbox decision.

### C. SQL index: "Why is one lookup slow in a big table?" (`backend.sql-basics` or a later node)

Story: finding one customer by email gets slower as the table grows.

| # | Step | Predict point |
|---|---|---|
| 1 | Problem | None |
| 2 | The table | None |
| 3 | Lookup by id | Rows the database looks at |
| 4 | Lookup by email | Rows looked at with no shortcut |
| 5 | What an index is | None (a sorted shortcut is drawn) |
| 6 | Same lookup, indexed | Rows looked at now |
| 7 | Case: 10× more rows | How both counts change |
| 8 | Case: add a row | What an insert must also update |
| 9 | Case: a column with no index | Predict the lookup cost |
| 10 | Recap | None |

Metric strip: rows examined, index entries read, writes per insert. Counts from a small toy table. I'm not sure the real engine (SQLite) exposes rows examined cheaply; if not, they are modelled counts, labelled. Evidence: predictions in 3, 4, 6, 7, 8, 9. Check: choose and justify an index for a given query set (apply, auto-checked on the plan), explain the cost of an index, transfer to another table.

## 5. Not copied

Their lesson text, story ("shop feels slow"), step names and 40-lesson outline; their isometric illustrations (we are 2D, and 3D was removed in `1845c368`); their three-column layout, stepper strip, colours and type; their name and branding. Ideas are free, but whether any wording or art ends up too close is for Lumi and Nova to check.

## 6. Open questions

For Aki:
1. Is this the standard form for all lessons on the Software Engineer path, with the short form for tiny concepts? Default: yes.
2. Are examples B and C fine as illustrations only? They need curated runs and a mock server or toy database that do not exist yet.
3. Real-world wrapper ("a notes app") or code only for the first stories? Default: one sentence of wrapper.

Nova's answers (2026-11-22, reversible; Arjun may rename fields when the harness is built):
- Step id: `FocusContext.viz_state.step_id` plus `step_name`.
- A case-step prediction is a `predict` record, not the transfer leg. Transfer stays a new-looking task (bug hunt or new setting).
- `break` stays in the loops story: it is part of "termination", which `python.loops` already covers.
- Who writes stories and runs: open, goes to Aki together with the item-bank question in `first-domain.md` (default: AI drafts, a human approves).
- Point values: samples until Aki sets them (D20).

Not checked: the site beyond two screenshots, any Nexora learner data, the exact edge cases of a mock server or SQLite counters.
