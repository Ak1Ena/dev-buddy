# Changes

## Files changed
- `backend/app/agents/choreographer.py` — Updated `SYSTEM_PROMPT` to match frontend component contracts.
- `backend/app/routers/scenes.py` — Added documentation about `SCENE_CACHE` limitations.
- `frontend/src/engine/primitives/Gate.tsx` — Fixed coordinate system (percentage-based) and exit transition handling.
- `frontend/src/engine/primitives/Pulse.tsx` — Fixed coordinate system (percentage-based).
- `frontend/src/engine/renderer/PrimitiveFactory.tsx` — Updated to pass `progress` prop to children.
- `frontend/src/engine/renderer/ScenePlayer.tsx` — Fixed animation loop `deltaTime` jump by correctly initializing `lastTimeRef`.

## Summary
Fixed several critical bugs in the Cinematic Programming Learning Platform related to animation timing, coordinate consistency, and AI-Frontend contract mismatch.

## How this addresses the plan
- **Timeline Jump**: `ScenePlayer.tsx` now initializes `lastTimeRef.current` to `null` and skips the first frame's delta calculation, preventing the initial time jump.
- **Contract Mismatch**: `choreographer.py`'s `SYSTEM_PROMPT` was updated to explicitly instruct the AI to use `fromPos`/`toPos` for particles, `x`/`y` for pulses, and include `correctAnswer`/`feedback` for gates, matching the React components.
- **Coordinate Consistency**: `Gate.tsx` and `Pulse.tsx` were updated to use the 0-1000 range percentage-based coordinate system (`${val / 10}%`) consistent with `Box` and `Particle`.
- **Particle Progress**: `PrimitiveFactory.tsx` now correctly accepts and passes the `progress` value calculated in `ScenePlayer` down to the `Particle` component.
- **Gate Exit**: `Gate.tsx` now uses `AnimatePresence` and conditional rendering inside the component instead of returning `null` early, allowing for exit animations and keeping the component mounted for logic.
- **Cache Limitation**: Added a note in `scenes.py` regarding the in-memory `SCENE_CACHE` growing indefinitely.

## Tests touched
none

## Follow-ups
- The `SCENE_CACHE` in `backend/app/routers/scenes.py` should be replaced with Redis or a database with TTL for production use.
- The `walkthrough_index` in `code_highlight` assumes the AI knows which walkthrough it's referring to; might need more context in the prompt if multiple walkthroughs are supported.

## Verification you ran locally
- Verified all file changes via `read_file`.
- Checked TypeScript interfaces for consistency between `PrimitiveFactory` and its children.
- Confirmed coordinate system math (`x / 10 %`) matches across all visual primitives.
