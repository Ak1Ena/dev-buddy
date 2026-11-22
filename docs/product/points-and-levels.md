# Points and levels

Status: **proposed** (Sage, 2026-11-22). Aki asked the team to think of values ("ลองคิดมาหน่อย"). Not decided until Aki confirms. Design only. Rules come from D20; evidence states from `first-domain.md`. Every number below is an assumption: no Nexora learner data exists yet.

## Rules (D20)
Points come only from verified evidence, replayed by the server (D6). Never from time, clicks, steps, predictions, video, chat, or streaks. Never shown as job readiness. Points and level never go down.

**Change from my earlier note (round 2):** I said points only when a concept reaches `verified`. Nova's brief and the mock's "+40 for passing the check" need feedback after each check, so points now come per evidence leg. The concept total is the same (100 at verified, 150 with retained). Say the word if you prefer one award at `verified`.

## 1. Point table (per concept, each earned once)

| Event | Points | Condition |
|---|---|---|
| Apply check passed | +30 | Code passes tests, hint ≤ 1 |
| Explain check passed | +30 | Rubric-graded, hint ≤ 1. LLM-graded, so it can never be the only record |
| Transfer check passed | +40 | New-looking problem, hint ≤ 1 |
| Retained | +50 | Fresh variant passed unhinted at least 3 days after verified |
| **Max per concept** | **150** | |

Always 0: predictions (they are evidence toward `in progress`, not points), steps, video, replay, finishing a lesson, hint 2 (partial credit), hint 3, a skip, the initial assessment (`verified: false`), passing a `needs_review` check again.

## 2. Levels (Software Engineer path)

Plain names for what the evidence shows, not job titles. Nothing says "ready" or "engineer".

| Level | Name | Points to reach | About |
|---|---|---|---|
| 1 | Newcomer | 0 | start |
| 2 | Explorer | 150 | 1 concept fully done |
| 3 | Apprentice | 400 | about 3 |
| 4 | Practitioner | 700 | about 5 |
| 5 | Builder | 1,000 | about 7 |
| 6 | Craftsperson | 1,800 | about 12 |
| 7 | Specialist | 3,000 | about 20 |

v1 has 8 real nodes, so the cap is 8 × 150 = 1,200: only levels 1 to 5 can be reached. Levels 6 and 7 stay hidden until enough nodes exist; show only the next level. Early levels come fast on purpose (assumption: an early win helps people start; nothing checked). Thresholds are in points, so adding concepts never rewrites a past level.

## 3. The "+N for ..." toast
Always name the evidence and the next gap:
- `+30 · Apply passed: Loops` and below it `1 of 3 checks for Verified`
- `+40 · Transfer passed: Loops` and `Loops is now Verified`
- `+50 · Still remembered after 5 days: Loops`
- Level-up: `Level 3 · Apprentice. 400 points from verified checks` (shows the cause, no confetti)
- Zero points: a plain line, never a toast: "No points: this check used a worked example (hint 3). A fresh one comes later."

Header: `Level 2 · Explorer · 180 points · 220 to Apprentice`. Path line stays separate: "2 of 35 skills with evidence for Software Engineer". Never combine them.

## 4. Anti-farming
- Each leg pays once per concept, ever. Retrying the same check pays nothing. A retry needs a fresh curated variant.
- Cap 150 per concept. No daily cap needed (nothing pays for time).
- Hint 2 or 3 on a leg pays 0; the leg can pay later on a fresh variant at hint ≤ 1.
- Retained needs the 3-day gap and an unhinted fresh variant.
- Editing or re-versioning a lesson never re-awards points.
- Points are derived from evidence records (award event keeps the record id), not a free counter, so they cannot drift from the evidence.
- No leaderboards or comparison with others (assumption: ranking invites gaming).
- Not solved: a learner pasting an AI answer. Mitigation: two of the three legs are deterministic checks, and the LLM-graded explain leg is only 30 of 150 points.

## 5. What the mock should show
Replace "Level 2 Explorer 120/200 +40" with: start `Level 2 · Explorer · 150 points · 250 to Apprentice` (one concept already verified). Passing the loops apply check shows `+30 · Apply passed: Loops · 1 of 3 checks for Verified` and the header becomes `180 points · 220 to Apprentice`. No level-up in the demo. Label all numbers "example numbers". Explain and transfer stay marked "not in the mock yet".

Open for Aki: confirm values and names; per-leg or one award at `verified`; whether to show the level name at all.
