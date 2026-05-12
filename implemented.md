# devBuddy AI — Implemented Changes Log

## Session: Lesson Page Overhaul (Viz + Code Tab Redesign)

---

### 1. Fix — Surrender Endpoint 500 Error
**File:** `backend/app/routers/learning.py`

After `db.commit()` the ORM lazy-loaded `remedial_lesson.progress` inside an async context, triggering a `MissingGreenlet` error. Fixed by reloading the lesson with explicit `selectinload(Lesson.progress)` after commit.

```python
await db.commit()
reloaded = await db.execute(
    select(Lesson)
    .options(selectinload(Lesson.progress))
    .where(Lesson.id == remedial_lesson.id)
)
loaded_lesson = reloaded.scalar_one()
return LessonSurrenderResponse(
    lesson=_format_lesson(loaded_lesson, space_id=path.learning_space_id),
    message="A focused deep-dive lesson has been added next.",
)
```

---

### 2. Fix — "Synthesizing Logic Topology" Placeholder Never Disappearing
**File:** `frontend/src/pages/Learn.tsx`

The loading placeholder checked `c?.animation_frames` — so any lesson without animation frames showed the spinner permanently. Fixed by gating on `loadingLesson` instead.

---

### 3. Fix — Assessment Generator Timeout
**File:** `backend/app/agents/assessment_generator.py`

Increased LLM call timeout from 10 s to 60 s to prevent premature timeout failures during assessment generation.

---

### 4. Feature — DataView Animation Improvements
**File:** `frontend/src/components/lesson/DataView.tsx`

Complete rewrite with:
- **StackView:** `initial={{ y: -24, scale: 0.88 }}` push animation, TOS badge, value-based keys, depth opacity `Math.max(0.45, 1 - depth * 0.18)`
- **QueueView:** `initial={{ x: 32, scale: 0.85 }}` slide-in, `mode="popLayout"`, FRONT/BACK labels outside scroll area
- **ArrayView:** `boxShadow` keyframe pulses on active/compare cells
- **VarRowItem:** extracted component with `useRef`/`useEffect` amber flash on value change
- **BranchView:** new component — diamond condition, sky TRUE / fuchsia FALSE branches with animated opacity

**File:** `frontend/src/types/index.ts`

Added `branch` to the DataView union:
```typescript
| { kind: "branch"; label: string; condition: string; true_path?: string[]; false_path?: string[]; active_path?: "true" | "false" | null; note?: string }
```

---

### 5. Fix — Viz Panel SVG Overflow
**File:** `frontend/src/pages/Learn.tsx`

Added `min-h-0` to the viz scroll container so the SVG no longer pushes `NodeDetail` off-screen. The flex-1 child now shrinks below its content height and enables internal scrolling.

---

### 6. Fix — Implementation Walkthrough Hidden on Code Tab
**File:** `frontend/src/pages/Learn.tsx`

Added `vizTab !== "code"` condition to hide the Implementation Walkthrough section when the Code tab is active, preventing duplicate content display.

---

### 7. Feature — Concept Tab: Tree/Graph Viz Instead of List
**File:** `frontend/src/pages/Learn.tsx`

Removed the Animation tab from the tab strip (now only **Concept** + **Code**). The Concept tab renders:
```tsx
<div className="flex h-full flex-col gap-2 overflow-hidden">
  {/* SVG scroll area — min-h-0 keeps NodeDetail docked below */}
  <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-800/60 bg-slate-950/40">
    <LessonViz viz={c.viz} onStepActivate={...} />
  </div>
  {/* NodeDetail docked outside scroll region */}
  <div className="shrink-0">
    <NodeDetail viz={c.viz} onJumpToCode={handleJumpToCode} />
  </div>
</div>
```

---

### 8. Fix — Concept Tab Blank (Unknown viz.kind)
**File:** `frontend/src/components/lesson/LessonViz.tsx`

`LessonViz` returned `null` for unrecognized `viz.kind` values. Added smart fallback in the `default` case:
```tsx
default: {
  const v = viz as any;
  if (v.nodes && v.edges) return <ConceptGraph nodes={v.nodes} edges={v.edges} />;
  if (v.nodes && v.root_id) return <ConceptTree rootId={v.root_id} nodes={v.nodes} />;
  if (v.steps) return <StepFlow steps={v.steps} onStepActivate={onStepActivate} />;
  return (
    <div className="flex items-center justify-center h-full min-h-[120px] p-6">
      <p className="text-xs text-slate-600 font-mono">No visualization for this lesson.</p>
    </div>
  );
}
```

**File:** `frontend/src/components/lesson/viz/ConceptTree.tsx`

Added right-edge overflow gradient (matching ConceptGraph style):
```tsx
<div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-slate-950/80 to-transparent z-10" aria-hidden />
```

---

### 9. Feature — Code Tab: New `CodeStepGraph` Component
**File:** `frontend/src/components/lesson/CodeStepGraph.tsx` (new)

Replaced the old CodePanel with a vertical step graph. Each walkthrough step is a clickable node:
- **Left rail** (3px): sky=active, emerald-60%=past, slate-800=upcoming
- **Code surface** on `bg-slate-950` with syntax highlighting (`text-[12.5px] leading-[1.7]`)
- Past nodes: `opacity-50`; upcoming nodes: `opacity-35`
- Step number as `font-mono text-[10px]` line-number style (no header row)
- Connector between nodes: line → 5 px dot → line
- Auto-scrolls active node into view via `useEffect` + `containerRef`
- Keyboard accessible with `aria-current="step"` and `focus-visible` ring

Syntax tokenizer (pure regex, no external deps):
- Keywords → `text-fuchsia-300`
- Strings → `text-amber-300`
- Numbers → `text-emerald-300`
- Comments → `text-slate-600`
- Default → `text-slate-300`

---

### 10. Feature — Code Tab: Split-Column No-Scroll Layout
**File:** `frontend/src/pages/Learn.tsx`

Replaced scrolling vertical stack with side-by-side layout:
```
┌────────────────────┬────────────────────────────────┐
│  CodeStepGraph     │  AnimationPlayer (flex-1)       │
│  (42%, internal    │                                 │
│   scroll)          ├────────────────────────────────┤
│                    │  WHY footer (shrink-0, docked)  │
└────────────────────┴────────────────────────────────┘
```

- Left `w-[42%] shrink-0 h-full overflow-y-auto border-r`
- Right `flex flex-1 flex-col min-h-0 overflow-hidden`
  - AnimationPlayer in `flex-1 min-h-0 overflow-hidden` wrapper
  - WHY panel as `shrink-0 border-t` with `AnimatePresence key={currentWalkthroughIndex}` crossfade and `aria-live="polite"`

---

### 11. Feature — Bidirectional Step ↔ Animation Sync
**File:** `frontend/src/pages/Learn.tsx`

Added proportional index mapping (no fixed frame→step metadata required):
```typescript
const stepToFrame = useCallback((stepIdx: number) => {
  const steps = lesson?.content?.code_walkthrough?.length ?? 0;
  const frames = lesson?.content?.animation_frames?.length ?? 0;
  if (frames === 0 || steps === 0) return 0;
  if (steps === 1) return 0;
  return Math.round((stepIdx / (steps - 1)) * (frames - 1));
}, [...]);

const frameToStep = useCallback((frameIdx: number) => {
  const steps = lesson?.content?.code_walkthrough?.length ?? 0;
  const frames = lesson?.content?.animation_frames?.length ?? 0;
  if (steps === 0 || frames === 0) return 0;
  if (frames === 1) return 0;
  return Math.round((frameIdx / (frames - 1)) * (steps - 1));
}, [...]);
```

Loop prevention: each setter guards with a value comparison (`if (next !== current)`) before calling the sibling setter.

---

### 12. Fix — AnimationPlayer Height-Aware
**File:** `frontend/src/components/lesson/AnimationPlayer.tsx`

- Root div: `h-full flex flex-col` — makes component fill its container
- Frame content div: `flex-1 min-h-0 overflow-y-auto` — scrolls internally when content overflows rather than expanding the container

---

### Build Status
All changes compile with no TypeScript errors. `npm run build` completes successfully (678 kB bundle).
