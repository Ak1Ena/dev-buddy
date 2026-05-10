# Bug Fix: Blank Screen on Lesson Click

## Problem Statement
Clicking a lesson card (e.g., "Functions & Parameters") results in a blank screen due to React crashes in frontend components.

## Root Causes
- `WorkshopExercise.tsx`: Unsafe access to `workshop.hints.length`.
- `CanvasScene.tsx`: Potential infinite recursion in `subtreeW` and unsafe access to `nodes.length`.
- `Learn.tsx`: Inefficient render loop causing performance issues and potential state sync bugs.
- Lack of Error Boundaries in the frontend.

## Implementation Plan

### Phase 1: Defensive Frontend Fixes
- [x] Fix `WorkshopExercise.tsx` hints access.
- [x] Fix `CanvasScene.tsx` nodes access and recursion.
- [x] Memoize `onFrameChange` in `Learn.tsx`.

### Phase 2: Structural Improvements
- [x] Implement `ErrorBoundary` component.
- [x] Wrap `Learn.tsx` content in `ErrorBoundary`.

### Phase 3: Backend Validation (Optional/Follow-up)
- [ ] Add schema validation for AI-generated lesson content in `learning.py`.

### Phase 4: Verification
- [x] Run `npm run build` in frontend.
- [x] Verify fix by clicking lesson cards (Verified via Playwright and automated tests).

## Status
- [x] Research completed by codebase_investigator.
- [x] Frontend defensive fixes and structural improvements implemented.
- [x] Build verified successfully.
- [x] E2E verification completed.

