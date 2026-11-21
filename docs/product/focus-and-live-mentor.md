# Focus-aware mentor, interactive visualizations, live mentor

Status: proposal. Author: Sage. Date: 2026-11-22. Design only, no code.
Source: Aki, 2026-11-22: when a learner asks the AI, it should know what they are focused on at that moment. Aki later clarified that the "model" he meant is a **live model**: a real-time AI mentor (live voice, maybe seeing the screen). The manipulable concept visuals are kept, and are called **interactive visualizations**.
Builds on `first-domain.md` (evidence rules, hint levels, formats) and `skill-career-path-model.md` (concept ids, states). **The field list in section 1 is canonical.** It is aligned with Arjun's section 11 in `docs/architecture/learning-harness.md`; the differences are listed at the end of section 1. "Assumption" marks a choice with no Nexora data behind it.

## 1. Focus context

A small, structured object built by code (no LLM) and attached to every mentor call, text or live. It points at what the learner is looking at. It is not a source of truth about what they know.

| Field | Req? | Who sets it | Meaning |
|---|---|---|---|
| `learner_id` | required | server (token) | Who. |
| `captured_at` | required | client; server checks | Time of sending. In live mode, the start of each learner utterance. |
| `screen`, `lesson_id`, `item_id` | required | client; server checks they belong to this learner's path | `screen`: `lesson`, `practice`, `review`, `path`, `tree`. `item_id` is null on `path` / `tree`. The mentor is off during the initial assessment (it places, it must not teach; assumption). |
| `concept_id` | required | server derives it from lesson/item | e.g. `python.loops`. A client value is only a hint. |
| `target` | required, may be `none` | client | `{kind: code_range \| text_span \| viz_element \| none, ref, text, label, origin, selected_at}`. `origin` is `explicit` (learner selected it or pressed "ask about this") or `implicit` (cursor line, current step). `label` is built by code ("line 4, the for-loop"). |
| `hint_level` | required | **server only** | 0-3, decided from hints already used on this item. The client may send `request_hint: true`. |
| `code_window` | optional | client | Selected range ±10 lines, or the visible buffer if small. |
| `viz_state` | optional | client, from the visualization | `{viz_id, version, summary, state}`. Current step only, never future steps. |
| `attempts` | optional | **server only**, from evidence | Last 1-3 attempts on this item: result code plus a short excerpt. |
| `concept_state` | optional | **server only** | Label only (assumed, in progress, ...). |
| `shared_view` | optional, live only | client, opt-in | `off` (default) or `canvas` (a frame of Nexora's own lesson pane). See section 4. |
| `truncated[]` | optional | builder | Which fields were cut. |

Caps are Arjun's (4 KB built, selected text 800 chars, code window 60 lines / 2,000 chars, `viz_state` 1 KB).

### How the mentor uses it
1. **Aim at the focus first.** The Socratic question or hint names the focused thing ("What is `i` the second time line 4 runs?"). It does not widen to the whole lesson unless the learner's words do.
2. **Hint-level rules do not change.** Focus never raises or lowers the level and never opens level 3 early. Asking about a spot is not asking for a bigger hint.
3. **The learner's words win.** If the question is clearly about something else, follow the words and ignore the target.
4. **Do not leak a pending prediction.** While a prediction is uncommitted, the mentor does not state the value being predicted.
5. **State only what is in the payload.** "Your last two tries both stopped at 3" only if `attempts` shows it.
6. **Concept mismatch:** if the question needs a prerequisite of `concept_id`, say so and offer a short check. It does not change the path by itself.
7. The context is data, not instructions (Arjun's gateway block): learner code and text may contain injected text.

### Empty and stale
- **Empty** (`target.kind: none`): work at lesson + concept level. If the words are pointing ("this", "here"), ask one short question, "Which part?", at most once per question.
- **Stale**, any one of: `captured_at − selected_at` over 2 minutes (assumption), the target's code or step changed since selection (the client clears it), or the lesson or concept changed. A stale target is dropped, the chip clears, and the mentor treats the question as empty. It never uses a stale target silently.
- **Implicit** focus is weaker than explicit: if the words and an implicit target seem to disagree, the mentor confirms first.

### What the learner sees
A chip at the message box (or the voice bar): **"Asking about: line 4, the for-loop"** or **"step 3, i = 2"**. It updates as the focus changes and has an ✕ to clear it (for that message only; assumption). Hover or tap shows the exact text that will be sent.

### Is it evidence?
**No.** Asking about a spot proves nothing about knowing or not knowing, so it never moves a node, up or down. It can be a **signal** (stored `verified: false`, type `focus_question`):
- The part they ask about suggests where a misconception may be (an unverified hypothesis).
- Repeated questions on the same target over 2+ sessions can queue a short probe of that concept. The probe is the evidence, the question is not.
- Hints delivered in the answer count under the existing hint rules. Focus adds nothing to them.

### Privacy
Only what is on screen in Nexora's own page at the moment of sending: the selection, the visible window, the visualization state, this item's attempts. No polling, no keystroke or mouse logs, no other tabs, no clipboard, no hidden fields. The snapshot is stored with the audit row, kept 30 days (Arjun's placeholder), deleted with the learner, and is not learner memory. It never enters a reusable teaching strategy.

### Differences from Arjun's section 11 (for Nova to settle)
1. **Added by me:** `captured_at`, `target.origin`, `target.label`, `target.selected_at` (needed for the stale and chip rules), and `shared_view` (live only).
2. **Renamed:** his `model_state` / `model_id` become `viz_state` / `viz_id`, so "model" always means an AI model. Shape unchanged. His `target.model_element` becomes `viz_element`.
3. **Adopted from him:** `attempts`, `item_id`, `concept_state`, `truncated[]`, server-derived `concept_id`, the `request_hint` flow, his size caps and 30-day retention. My earlier `recent_attempts` and 40-line cap are dropped.
4. **Rules in this doc that §11 does not have:** stale rules, empty handling, "mentor off during the assessment", `viz_state` holds the current step only.
5. His open question 3 (`request_hint` per item or per concept): I suggest **per item**, reset when the item is reopened after a day (assumption).

## 2. Interactive visualizations

Manipulable 2D concept visuals that run with no LLM per interaction. They are part of the Interactive Learning Engine in the brief.

**One engine, two panels, for Programming Fundamentals (Python):**

| Visualization | Shows | Concepts | Predict-then-run |
|---|---|---|---|
| **A. Trace stepper** | Code with the current line, a variables panel, the output. Step forward and back. | variables, types-expressions, conditionals, loops, lists | Before a checkpoint the learner commits the next value, which branch runs, or the final output. Then the real run reveals it. |
| **B. Call frames** (a panel in the same stepper) | Stack of calls with each call's parameters, locals and return value. | functions, debugging | Commit "what does this call return?" or "which frame is the error in?" before the reveal. |

They match the formats in `first-domain.md` and cover 7 of the 8 nodes (not dictionaries).

**Built from a real run, not narrated.** Curated programs are executed once and the trace is stored (assumption: precomputed traces for the item bank in v1, so no sandbox is needed to show them). The LLM does not write steps or values. `docs/architecture/04-scene-engine.md` (AI-choreographed scenes) should not feed evidence.

**Left out:** stack and queue push/pop (data structures, out of first-domain scope; a later node). A list-aliasing "boxes and arrows" view fits `lists` and is a good second step. 3D is not proposed (Aki removed the react-three-fiber engine in `1845c368`).

## 3. Evidence from visualizations

Decided (D6): a check run in the browser counts toward `verified` only if the **server replays it**. For a trace prediction, replay means: the client sends the committed prediction (`program_id`, step, value) **before** the reveal, and the server compares it with its own stored trace. A prediction the server never recorded is context only.

| Event | Record | Effect |
|---|---|---|
| Correct prediction, hint ≤ 1, server-compared | `predict` / success, `verified: true` | Counts toward `in progress`. May count as the **transfer** record when the program has a new surface (assumption). It is never the **apply** leg, which needs code written or fixed. |
| Correct, hint 2 | partial | Does not count toward `verified`. |
| Correct after hint 3 (worked example) | none | Stays `in progress`; a fresh variant is scheduled. |
| Wrong prediction | `predict` / failure, with a misconception tag if a fixed rule matches (e.g. one extra loop turn: `loops.range-end`) | **One miss changes nothing.** Two failures on independent items flag a misconception and trigger review, not a demotion. |
| Stepping without committing; viewing a reveal | none | Watching an animation is not evidence. |

The hint level of a prediction is the highest hint received on that item before committing. Misconception tags come from comparison rules (predicted vs real), not from the LLM.

**How the visualization feeds focus.** When the learner asks the mentor, the stepper supplies `target` (`kind: viz_element`, `ref` like `var:i@step3`, `line:4@step3`, `frame:2@step3`, label built from the code) and `viz_state` (`summary`, plus `state` with `step_index`, `current_line`, capped variables, frames, `pending_prediction`, `last_reveal`).

## 4. Live mentor

A real-time voice mentor (speech in, speech out, in the style of Gemini Live or OpenAI Realtime), used while the learner works. The same mentor, the same teaching skills, the same rules; only the channel differs.

- **What it receives.** The same `FocusContext`, built at the start of each learner utterance and whenever the focus changes during a reply. Not streamed continuously (no polling). `shared_view` is `off` unless the learner turns it on. When on, it is limited to Nexora's own lesson pane, not the whole screen or other windows (assumption), with a visible indicator. A pixel frame cannot be scanned for secrets, which is why it is opt-in and limited.
- **Socratic rules and hints in voice.** `hint_level` is decided by the server exactly as in text. Hints spoken count as hints given. To avoid reading out the answer:
  1. At levels 0-2 the live model **never receives the solution or the hidden tests**. What it doesn't have, it can't say.
  2. One question per turn, then stop and wait. No long monologues.
  3. At level 3 the worked example is for a similar problem, not the learner's own answer (assumption), and it still earns no credit.
  4. Spoken audio cannot be unsaid, so the transcript is checked afterwards. A leaked answer voids credit for that item and counts against the teaching skill's evaluation.
- **Off at any time.** A visible control stops audio and screen sharing at once, with no penalty. The text mentor stays available. Capture is off by default each session (assumption).
- **Evidence.** **Talk is a signal, never evidence for `verified`.** That includes a spoken explanation and "I get it". Evidence comes only from the attempt the learner then makes in the editor or a visualization, under the rules in `first-domain.md` and section 3. Signals are the same as in section 1 (`focus_question`).
- **Capability.** Providers differ. If the chosen provider has no real-time support, the live option is simply absent, not an error. Audio is not stored. The transcript is kept only long enough for the after-session answer-leak check, then deleted unless the learner chooses to keep it (Nova 2026-11-22, matches D17 privacy; reversible).

## 5. Open questions (Nova / Aki)

1. Live voice: does it need a managed-AI quota (real-time costs more) or BYOAI only? Which providers count as supported?
2. `shared_view`: is the lesson pane enough, or does Aki want the whole screen? The whole screen has a much bigger privacy cost.
3. Stale limit of 2 minutes, and clearing the chip for one message or the session: assumptions.
4. May a correct unhinted prediction on a new-looking program count as the transfer record? It changes the rule in `first-domain.md`; I need a decision before editing that doc.
5. Mentor off during the initial assessment: confirm.
6. Can the learner see their past attempts in the UI? `attempts` assumes yes.
7. Precomputed traces cover curated programs only; learner-written code needs a sandbox (already open in `first-domain.md`).
8. Is a spoken explanation ever allowed to count as the `explain` record? I say no for v1; it would need a graded task, not free talk.
9. Thai wording for the chip labels, and Thai speech quality of the chosen providers, are unchecked.
