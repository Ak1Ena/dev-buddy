# devBuddy AI — Learning & Execution Visualization System
## Design Specification v1.0

---

## 1. Overview & Design Goals

### Problem Statement
devBuddy AI teaches programming through Socratic questioning. The lesson viewer presents dense technical content — code, concepts, execution flow — across two panels. The right panel hosts all visualizations (concept diagram, annotated code, animated execution). Without a coherent design system governing each viz type, the panel risks becoming a cluttered, inconsistent space that overwhelms beginners.

### Design Goals
1. **Make invisible processes visible** — Show execution state, concept relationships, and data flow in forms that beginners can reason about without prior CS background.
2. **Reinforce the Socratic principle** — Visualizations must hint and reveal progressively; they must not spoil what the animation checkpoint system is trying to elicit from the learner.
3. **Maintain a single interaction model across all viz types** — Hover to peek, click to pin, Escape to clear. One mental model for everything.
4. **Support bidirectional code-viz linking** — Hovering a viz node highlights the corresponding code lines; hovering a code line lifts the corresponding viz node. The `lessonHighlight` Zustand store is the single source of truth for this linkage.
5. **Serve beginners first** — Minimize labeling jargon, maximize spatial clarity, and provide a tooltip/detail panel for every interactive node.

### Established Token Conventions
The codebase uses a consistent dark theme throughout. These are the active tokens:

| Semantic Role         | Tailwind Class                              | Hex Approx   |
|-----------------------|---------------------------------------------|--------------|
| Page background       | `bg-slate-950`                              | #020617      |
| Panel background      | `bg-slate-900/40`                           | #0f172a ~60% |
| Surface / card        | `bg-slate-900/70` or `bg-slate-800/60`      | #1e293b      |
| Primary accent        | `text-sky-400`, `bg-sky-500/15`             | #38bdf8      |
| Active / pinned       | `stroke-sky-400`, `bg-sky-500/15`           |              |
| Emphasis / why        | `text-amber-400`, `border-amber-500/20`     | #fbbf24      |
| Success / complete    | `text-emerald-400`, `bg-emerald-500/10`     | #34d399      |
| Checkpoint / gate     | `border-amber-500/30`, `bg-amber-500/5`     |              |
| Fuchsia accent        | `text-fuchsia-400`, `bg-fuchsia-500/10`     | #e879f9      |
| Muted label           | `text-slate-500`, `text-[10px] uppercase tracking-widest` | #64748b |
| Border default        | `border-slate-700/60`, `border-slate-800/60`|              |
| Glow effect           | `shadow-sky-900/30`, SVG filter `tree-glow` |              |
| Node default fill     | `fill-slate-900/70 stroke-slate-700/60`     |              |
| Node active fill      | `fill-sky-500/15 stroke-sky-400`            |              |

---

## 2. Viz Type Catalog

### 2.1 StepFlow

**Purpose:** Represent sequential execution — the order in which code statements run. Best for: loops, function call sequences, pipeline stages.

**Data shape:**
```ts
{ kind: "flow"; steps: VizNode[] }
// VizNode: { id, label, summary, code_ref?, children? }
```

**When the AI selects this:** When the lesson topic is procedural (a for-loop iterating, a list being processed left-to-right, a chain of operations). The step count mirrors the `code_walkthrough` length; each step should have a `code_ref.walkthrough_index` pointing to its code block.

#### Layout

```
┌───────────────────────────────────────────────────────────────┐
│  STEP FLOW                                         flex-wrap  │
│                                                               │
│  ╔══════╗  >  ╔══════════╗  >  ╔══════════╗  >  ╔════════╗  │
│  ║  1   ║     ║    2     ║     ║    3     ║     ║   4    ║  │
│  ║Label ║     ║  Label   ║     ║  Label   ║     ║ Label  ║  │
│  ╚══════╝     ╚══════════╝     ╚══════════╝     ╚════════╝  │
│                                                               │
│  (on narrow viewport: wraps to rows with connector lines)    │
└───────────────────────────────────────────────────────────────┘
```

**Current implementation notes:** The existing `StepFlow.tsx` renders pill-shaped buttons with numbered badges and `ChevronRight` separators. The interaction model is correct. Key design gaps to address:

1. **No visual progress indicator** — there is no way for the learner to see which steps are "done" vs "upcoming". Add a `completedUpTo` prop (passed from the parent based on `currentWalkthroughIndex`) that applies `bg-emerald-500/15 border-emerald-500/40 text-emerald-300` to all steps at or before the current index.

2. **Overflow handling on mobile** — the current `flex-wrap` layout loses the directed-flow affordance when pills wrap. On `sm` and below, switch to a vertical stack:

```
Mobile (< 640px):
┌─────────────────────┐
│  ① Initialize loop  │
│         |           │
│  ② Check condition  │
│         |           │
│  ③ Execute body     │
└─────────────────────┘
```

**Tailwind classes for states:**

| State       | Classes |
|-------------|---------|
| Default     | `border-slate-700/60 bg-slate-900/40 text-slate-300` |
| Hover       | `hover:-translate-y-[2px] hover:border-slate-500 hover:bg-slate-800/60` |
| Active/Pinned | `border-sky-400 bg-sky-500/15 text-sky-200 -translate-y-[2px] shadow-lg shadow-sky-900/30` |
| Completed   | `border-emerald-500/40 bg-emerald-500/10 text-emerald-300` |
| Code-linked | Same as active; triggered by `codeRefOverlaps` in `lessonHighlight` |

**Proposed `completedUpTo` prop addition:**
```tsx
// In StepFlow.tsx
interface Props {
  steps: VizNode[];
  onStepActivate?: (walkthroughIndex: number | undefined) => void;
  completedUpTo?: number; // walkthrough_index of the currently active code block
}
```
Derive `isCompleted = step.code_ref ? step.code_ref.walkthrough_index < (completedUpTo ?? -1) : false`.

**Accessibility:**
- Each step is a `<button>` with `role="button"` implicit, `aria-pressed` for pinned state.
- Arrow-key navigation left/right already implemented via container `keydown` listener.
- Add `aria-current="step"` to the active step when it is the one matching `completedUpTo`.
- The connector `ChevronRight` icons carry `aria-hidden`.

---

### 2.2 ConceptTree

**Purpose:** Decompose a concept into its hierarchical parts. Best for: function anatomy (name + params + body + return), data structure parts (list → elements → index), syntax structures.

**Data shape:**
```ts
{ kind: "tree"; root_id: string; nodes: VizNode[] }
// nodes include children: string[] to define parent-child edges
```

**When the AI selects this:** When the lesson's central concept has a clear part-whole structure with one root. Examples: "a function has a name, parameters, a body, and a return value."

#### Layout

The SVG-based tidy layout algorithm is already implemented in `ConceptTree.tsx`. Key constants:

```
NODE_W = 168px   NODE_H = 60px
HSPACE = 24px    VSPACE = 88px
```

Visual structure:
```
                ┌─────────────────┐
                │   Root concept  │
                │  (sky border)   │
                └────────┬────────┘
          ┌──────────────┼──────────────┐
    ┌─────┴─────┐  ┌──────┴─────┐  ┌───┴──────┐
    │  Child A  │  │  Child B   │  │  Child C │
    └─────┬─────┘  └────────────┘  └──────────┘
    ┌─────┴─────┐
    │ Grandchild│
    └───────────┘
```

**Design gaps to address:**

1. **No visible root emphasis** — The root node looks identical to children. Add a distinct root style: `fill-fuchsia-500/10 stroke-fuchsia-400/60` with a subtle `strokeWidth={2}` and apply the glow filter by default (not just on hover).

2. **Edge labels** — The tree currently draws edges without labels. For trees where the relationship name matters (e.g. "inherits from"), the parent prompt should populate `children` and the edge SVG path should optionally render a label midpoint. Since VizNode does not carry edge label data, this is a schema gap — add an optional `edge_label_to_children: string` field to VizNode in the schema (future work, not blocking).

3. **Empty / single-node tree** — If `nodes.length === 1`, render the root as a large centered card without the SVG entirely:
```
┌──────────────────────────────────┐
│  ◆  Single Concept               │
│  Summary text that explains      │
│  what this concept is.           │
└──────────────────────────────────┘
```
Use `rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-6` for this fallback state.

**Tailwind classes for nodes:**

| State       | SVG `rect` fill / stroke |
|-------------|--------------------------|
| Root default | `fill-fuchsia-500/10 stroke-fuchsia-400/60` |
| Child default | `fill-slate-900/70 stroke-slate-700/60` |
| Hovered/Pinned | `fill-sky-500/15 stroke-sky-400` (with glow filter) |
| Code-linked | Same as hovered/pinned |

**Node label overflow:** `label` is capped at 24 chars by the backend schema. The `foreignObject` renders a `truncate` div — this is correct. `summary` uses `line-clamp-2` at `text-[10px]`, which is correct for the 148px inner width.

**Accessibility:**
- `role="button"` on each `<g>` with `tabIndex={0}` — already implemented.
- Arrow key navigation (up/down/left/right tree traversal) already implemented in `moveFocus`.
- `aria-pressed` for pinned state — already implemented.
- `aria-label` combines label + summary + code_ref lines — already implemented.
- Add `aria-describedby` pointing to the NodeDetail panel `id` when a node is pinned.

---

### 2.3 ConceptGraph

**Purpose:** Show bidirectional or multi-directional relationships between concepts. Best for: variable ↔ scope ↔ lifetime, inheritance chains, module dependency maps, concept comparisons where directionality matters.

**Data shape:**
```ts
{ kind: "graph"; nodes: VizNode[]; edges: VizEdge[] }
// VizEdge: { source, target, label?, code_ref? }
```

**When the AI selects this:** When concepts relate to each other laterally rather than hierarchically. Typical trigger: lesson about scoping, closures, or inter-module relationships.

#### Layout

The existing placement algorithm uses BFS topological depth for layered layout (left-to-right), with circular fallback for disconnected nodes. Constants mirror ConceptTree:

```
NODE_W = 168px   NODE_H = 60px
Column gap: NODE_W + 80 = 248px
Row gap: NODE_H + 56 = 116px
```

Visual structure:
```
┌────────┐         ┌────────┐
│ Node A │────────>│ Node C │
└────────┘         └────────┘
    |
    | uses
    v
┌────────┐
│ Node B │
└────────┘
```

**Design gaps to address:**

1. **Edge labels are invisible at small sizes** — the `<text>` element renders at the SVG default font size and has no explicit `font-size` attribute. Fix: add `fontSize="10"` and `fill="rgb(100 116 139)"` (slate-500 equivalent) to edge label text elements. Position at midpoint minus 6px above the path.

2. **No scroll hint for overflow** — when graph bounds exceed the container, there is no affordance that the user can scroll. Add a subtle gradient fade on the right edge: `after:absolute after:right-0 after:top-0 after:h-full after:w-8 after:bg-gradient-to-l after:from-slate-950/80 after:to-transparent after:pointer-events-none` on the container div, conditionally shown when `bounds.w > containerWidth`.

3. **Arrow marker color** — the current marker fill uses a raw RGB value `rgb(100 116 139)` which matches slate-400. Maintain this but consider brightening active-edge arrows to `rgb(56 189 248)` (sky-400) when either endpoint is hovered/pinned. This requires edge-level state derived from `hoveredNodeId`.

**Active edge highlighting:**
```tsx
// Derive in the component
const activeEdges = useMemo(() => {
  const id = pinnedNodeId ?? hoveredNodeId;
  if (!id) return new Set<number>();
  return new Set(
    edges
      .map((e, i) => (e.source === id || e.target === id ? i : -1))
      .filter((i) => i >= 0)
  );
}, [edges, hoveredNodeId, pinnedNodeId]);
```
Apply `stroke="rgb(56 189 248)"` and `strokeWidth={2}` on active edges, `stroke="rgb(71 85 105 / 0.7)"` on inactive.

**Accessibility:**
- Same as ConceptTree: `role="button"`, `tabIndex`, Arrow key nav (linear, wrapping), `aria-pressed`.
- Edge `<path>` elements: add `aria-label={e.label ?? "relates to"}` and `role="img"` so screen readers can describe the relationship.

---

### 2.4 ComparisonTable

**Purpose:** Side-by-side comparison of 2–4 alternatives across shared attributes. Best for: list vs tuple, for-loop vs while-loop, mutable vs immutable, let vs const vs var.

**Data shape:**
```ts
{ kind: "table"; columns: string[]; rows: VizTableRow[] }
// VizTableRow: { label: string; cells: VizTableCell[] }
// VizTableCell: { value: string; code_ref? }
```

**When the AI selects this:** When the lesson explicitly contrasts two or more approaches and asks the learner to understand the tradeoffs.

#### Layout

```
┌─────────────────┬─────────────────┬─────────────────┐
│ (row label col) │    Column A     │    Column B     │
├─────────────────┼─────────────────┼─────────────────┤
│ Attribute 1     │   Cell value    │   Cell value    │
├─────────────────┼─────────────────┼─────────────────┤
│ Attribute 2     │   Cell value    │   Cell value    │
└─────────────────┴─────────────────┴─────────────────┘
```

The sticky left column and pinnable column headers are already implemented correctly. The interaction model (click a column header to pin it, fade others) is well-designed.

**Design gaps to address:**

1. **No empty state** — if `rows.length === 0`, render a placeholder:
```tsx
<div className="flex items-center justify-center p-12 text-slate-600 text-sm">
  No comparison data available
</div>
```

2. **Column count overflow on mobile** — with 4 columns the table overflows at `sm`. The `overflow-x-auto` wrapper handles scroll, but add a horizontal scroll shadow hint:
```
Container: relative overflow-x-auto
After pseudo-element: gradient fade on right edge (same pattern as ConceptGraph)
```

3. **No "why does this matter" row** — the table currently shows factual values but no pedagogical emphasis. Consider adding optional row-level emphasis: if a row's `label` contains a `*` suffix, render it with `text-amber-300 font-semibold` to flag it as a "key distinction" row. This requires no schema change — it's a display convention the AI prompt can follow.

4. **Code-linked cell elevation** — the existing `shadow-[0_4px_12px_-4px_rgba(56,189,248,0.4)]` and `-translate-y-[2px]` on linked cells is a strong affordance. Keep it. The pinned-column fade (`opacity-40`) works well for focus.

**Accessibility:**
- `<table>` with `<thead>`, `<tbody>`, `<th scope="col">`, `<th scope="row">` — the current implementation uses `<th>` without scope. Add `scope="col"` to column headers and `scope="row"` to row label cells.
- Column header `role="button"` + `aria-pressed` for pinned state — already implemented.
- Cell `aria-label` combining value + code ref lines — already implemented.
- Keyboard: Tab navigates through headers (focusable). For full keyboard row navigation, add `tabIndex={0}` to data cells and arrow-key handlers if needed (lower priority).

---

### 2.5 CodePanel

**Purpose:** Display annotated code with per-line highlighting synced to the active viz node or walkthrough index. Acts as the code reading lens within the "Code" tab.

**Data shape:** Receives `items: WalkthroughItem[]` (from `code_walkthrough`), `viz?: Viz`, `activeIndex`, and `onActiveIndexChange`.

**When shown:** The "Code" tab in the right panel, only visible when `code_walkthrough` exists. This is not a viz type selected by the AI — it is always present when walkthrough data exists.

#### Layout

```
┌──────────────────────────────────────────────┐
│ Code  [Block 2/4]          ● ● ● ●  (dots)  │  ← header
├──────────────────────────────────────────────┤
│  1 │ def greet(name):                        │
│  2 │     return f"Hello, {name}"  ← highlight│  ← scrollable code body
│  3 │                                         │
├──────────────────────────────────────────────┤
│ WHAT IT DOES                                 │  ← footer
│ The function returns a formatted string...   │
│ ⚡ Why: f-strings are more readable than...  │
└──────────────────────────────────────────────┘
```

**Design gaps to address:**

1. **No syntax highlighting** — all code renders as plain text in `text-sky-100` or `text-slate-400`. For a code education tool this is a significant omission. Recommended approach: integrate `highlight.js` or `prism-react-renderer` with a dark theme matching the palette. Minimum viable: tokenize keywords, strings, and comments with distinct colors.

   Suggested palette for syntax highlighting (WCAG AA against `bg-slate-950`):
   - Keywords (`def`, `for`, `if`, `return`): `text-fuchsia-300` (#f0abfc) — 7.2:1 contrast
   - Strings: `text-amber-300` (#fcd34d) — 9.1:1 contrast
   - Comments: `text-slate-500` (#64748b) — 4.7:1 contrast
   - Numbers / literals: `text-emerald-300` (#6ee7b7) — 8.4:1 contrast
   - Default / identifiers: `text-slate-200` (#e2e8f0) — 13.5:1 contrast

2. **Dot navigation is too small on mobile** — the `h-1.5 w-4` dots (expanding to `w-6` when active) are 6px tall. Minimum touch target is 44px. Wrap each dot in a `<button>` with `p-3` padding and hide the visual dot inside, or switch to numbered pill buttons on mobile.

3. **Highlighted line contrast** — `bg-sky-500/[0.08]` on `bg-slate-950` produces a very subtle highlight. This is intentional for not being distracting, but the left accent bar `bg-sky-400` (3px wide) is the primary signal. Keep both; the bar is sufficient.

4. **The "Block X / Y" label** — this counter implies the user should navigate blocks. Make the navigation intent clearer by adding small `<` and `>` arrow buttons flanking the counter on mobile.

**Accessibility:**
- The per-line `<div>` hover states need `aria-current="true"` on the highlighted line group, not just visual styling.
- `onMouseEnter/onMouseLeave` for code-to-viz linking — also needs `onFocus/onBlur` for keyboard users. A sighted keyboard user tabbing through code lines should also trigger the viz highlight.
- The dot nav buttons already have `aria-label="Go to code block N"` — correct.

---

### 2.6 AnimationPlayer

**Purpose:** Frame-by-frame stepped execution of code. Each frame shows a snapshot of program state via `data_views` (preferred) or `canvas_scene` (fallback). Checkpoint frames block progression until the learner makes a prediction in the chat.

**Data shape:** `AnimationFrame[]` — see `AnimationFrame` in `types/index.ts`.

**When shown:** The "Animation" tab, or the full right panel when no `viz` is present.

#### Layout

```
┌──────────────────────────────────────────────┐
│  [●3]  Logic Stream    Frame 3 of 7          │
│  [0.5x][1x][2x]                 [▶ Auto]     │
├──────────────────────────────────────────────┤
│  Frame Title                                  │
│  Narration text (1 sentence)                  │
│                                               │
│  ┌─ Live State ────────────────────────────┐ │
│  │  total = 0                              │ │
│  │  numbers = [1, 2, 3, 4, 5]             │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  [Variables]     [numbers array with cursor] │
│                                               │
│  [CHECKPOINT GATE — amber — if applicable]   │
├──────────────────────────────────────────────┤
│  [← Back]    ● ● ● ● ● ● ●   [Proceed →]    │
│                  [progress bar]               │
└──────────────────────────────────────────────┘
```

**Design gaps to address:**

1. **DataView components need a dedicated design spec** — they are referenced in `AnimationPlayer.tsx` but not part of the files in scope here. The `DataViewRenderer` component renders arrays, vars, objects, stacks, and queues. The design for these sub-views is covered in Section 3.5 below.

2. **Checkpoint gate Socratic alignment** — the amber "Discovery Gate" gate is well designed but the CTA says "REVEAL OUTCOME". This slightly breaks the Socratic principle by implying the answer is about to be shown. Reframe the copy:
   - Before the learner has hypothesized in chat: button reads "I've made my prediction" (enabled immediately — we trust the learner to use the chat)
   - This avoids blocking the learner if they already know the answer and don't need the chat

3. **Frame dot nav overflow** — with 7 frames, 7 dots fit. With more (edge case), dots overflow. Cap at 7 visible + "..." pill. Alternatively, collapse to a `"Frame N of M"` text-only indicator past 10 frames.

4. **Speed selector on mobile** — the speed selector is `hidden sm:flex`. On mobile the user has no speed control. Move it inside the controls footer row and use icon-only buttons.

5. **Auto-play progress bar** — the absolute-positioned bar at `bottom-0` can be obscured by the controls footer. Move it between the frame content and controls footer as a dedicated `h-1` divider bar.

**Accessibility:**
- Play/Pause button: `aria-label={autoPlay ? "Pause autoplay" : "Start autoplay"}` — currently missing explicit aria-label.
- Frame dot buttons: `aria-label={`Frame ${i+1}${i === idx ? ', current' : ''}`}` and `aria-disabled` when checkpoint-locked.
- Checkpoint gate: `role="dialog"` with `aria-modal="false"` (it's inline, not truly modal) and `aria-labelledby` pointing to the "Active Prediction Required" heading.
- Speed buttons: `aria-pressed={speed === s}`.

---

## 3. LessonViz Container Design

### 3.1 Right Panel Architecture

The right panel (`w-[42%]` of the lesson view) is the visualization space. Its structure when a `viz` is present:

```
┌─────────────────────────────────────────────────┐
│ [Concept] [Code] [Animation]   ← tab strip      │  h: ~44px
│  bg-slate-950/40 border-b border-slate-800/60   │
├─────────────────────────────────────────────────┤
│                                                  │
│         ACTIVE TAB CONTENT                       │  flex-1 overflow-hidden
│                                                  │
│  "Concept" tab:                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  LessonViz (scrollable svg container)     │  │  flex-1 overflow-auto
│  │  bg-slate-950/40 rounded-xl border        │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  NodeDetail (animated, below viz)         │  │  shrink-0
│  └───────────────────────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 3.2 Tab Strip Design

Current tab strip classes are correct. Proposed refinements:

**Tab button classes:**
```tsx
// Active:
"rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider
 bg-sky-500/15 text-sky-300 border border-sky-500/30"

// Inactive:
"rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider
 text-slate-500 hover:text-slate-200 border border-transparent
 hover:bg-slate-800/40 transition-all"
```

**Tab availability indicators:** When a tab is available (e.g., "Code" only when `code_walkthrough` exists), its absence from the strip is the correct signal. Do NOT gray out unavailable tabs — remove them entirely. This is already implemented correctly.

**Tab strip accessibility:**
- Wrap the tab buttons in a `role="tablist"` element.
- Each button gets `role="tab"` and `aria-selected={vizTab === t.key}`.
- The content area below gets `role="tabpanel"` and `aria-labelledby` pointing to the active tab's id.
- Arrow keys should navigate between tabs (Left/Right), with Tab moving into the panel content.

```tsx
// Tab strip wrapper:
<div role="tablist" aria-label="Visualization panel tabs" className="...">
  {tabs.map(t => (
    <button
      role="tab"
      id={`tab-${t.key}`}
      aria-selected={vizTab === t.key}
      aria-controls={`panel-${t.key}`}
      ...
    >
```

### 3.3 LessonViz Container (viz types)

`LessonViz.tsx` is a pure switch dispatcher — it renders nothing itself except the selected viz component. The container styling is applied by the parent in `Learn.tsx`:

```tsx
<div className="flex-1 overflow-auto rounded-xl border border-slate-800/60 bg-slate-950/40 p-3">
  <LessonViz viz={c.viz} onStepActivate={...} />
</div>
```

**Design issue:** The `p-3` padding collapses SVG-based vizes (ConceptTree, ConceptGraph) against the border. ConceptTree's SVG viewBox already includes `-20` padding internally. For table and flow, the `p-3` is appropriate. Solution: pass a `noPadding` prop from `LessonViz` down, or use zero padding on the container and let each viz manage its own internal padding.

Recommended: remove `p-3` from the container and add internal padding per viz type:
- `ConceptTree`: SVG handles its own via viewBox offset
- `ConceptGraph`: Same
- `ComparisonTable`: Add `m-3` wrapper inside
- `StepFlow`: Add `px-3 py-2` wrapper inside

### 3.4 NodeDetail Panel

The `NodeDetail` panel slides up below the viz area when a node is hovered or pinned. Current implementation is well-designed. Refinements:

**Height budget:** The panel must not exceed `~120px` to avoid compressing the viz area on laptop-sized screens. Current content (label, summary, code_ref line indicator, Jump button) fits within this budget.

**Empty state:** When no node is selected, the panel area collapses completely (`AnimatePresence` → `exit`). This is correct — do NOT show a placeholder like "hover a node to see details" as it takes up vertical space unnecessarily. The viz nodes themselves communicate interactivity through hover states.

**Jump to Code button UX:** The `Jump to code →` button switches the tab to "Code" and scrolls to the relevant block. This is a key cross-component action. Ensure it has a focus ring:
```
focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
```

### 3.5 DataView Sub-Components (inside AnimationPlayer)

These render inside each `AnimationFrame`. Design guidance for the `DataViewRenderer` and its children:

**Array view:**
```
label: "numbers"
┌──────┬──────┬──────┬──────┬──────┐
│  1   │  2   │  3   │  4   │  5   │   ← cells
│ [0]  │ [1]  │ [2]  │ [3]  │ [4]  │   ← index labels
└──────┴──────┴──────┴──────┴──────┘
           ↑
         i=1 (fuchsia cursor)
```

Status colors for cells:
| Status    | Background                  | Text              | Border               |
|-----------|-----------------------------|-------------------|----------------------|
| `filled`  | `bg-slate-800/60`           | `text-slate-300`  | `border-slate-700/50`|
| `empty`   | `bg-slate-900/40`           | `text-slate-600`  | `border-slate-800 border-dashed` |
| `active`  | `bg-sky-500/10`             | `text-sky-300`    | `border-sky-500/50`  |
| `updated` | `bg-fuchsia-500/10`         | `text-fuchsia-200`| `border-fuchsia-500/40`|
| `compare` | `bg-amber-500/10`           | `text-amber-200`  | `border-amber-500/40`|
| `result`  | `bg-emerald-500/10`         | `text-emerald-200`| `border-emerald-500/40`|
| `removed` | `bg-slate-950/60 opacity-40`| `text-slate-500 line-through` | `border-slate-800`|

Cursor design: small arrow or label below the array cell, colored by cursor's `color` field:
```
┌──────┐
│  3   │
│ [2]  │
└──┬───┘
   ▼
 i=2  (text-fuchsia-400 bg-fuchsia-500/10 rounded-full px-1.5 py-0.5 text-[9px])
```

**Vars view:**
```
┌─ Variables ──────────────────────┐
│  total   │  1    updated (fuchsia)│
│  step    │  0    filled           │
└──────────────────────────────────┘
```
Table with `name` column (`text-slate-400 font-mono text-xs`) and `value` column (status-colored, `font-mono font-bold text-sm`). Optional `note` renders as a `text-[10px] text-slate-500 italic` below the value.

**Stack view:**
```
┌─ Call Stack ─────┐
│  greet("Alice")  │  ← top (most recent)
│  main()          │
└──────────────────┘
```
Renders items in reverse order (last item = top). Each item is a `rounded-md border border-slate-700/50 bg-slate-800/40 px-3 py-1.5 text-xs font-mono`. The top item gets `border-sky-500/40 bg-sky-500/10`.

**Queue view:** Renders items in order (first item = front/left). Same cell style as stack but horizontal layout with a `←` dequeue indicator on the left end.

**Object view:** Same as vars view but uses `key → value` terminology in the heading: `┌─ my_dict ─────┐`.

---

## 4. AI Selection Logic

### 4.1 Decision Rules (for the Designer Agent prompt)

The existing `DESIGNER_SYSTEM` prompt in `designer.py` already documents the selection criteria. This section formalizes it as a decision tree for clarity when tuning the prompt.

```
LESSON TOPIC
│
├─ Has a single dominant concept with sub-parts?
│   Example: "function anatomy", "list structure", "if-statement parts"
│   → kind: "tree"
│   Root = the main concept, children = its components
│
├─ Compares 2-4 alternatives across shared attributes?
│   Example: "list vs tuple", "for vs while", "mutable vs immutable"
│   → kind: "table"
│   Columns = alternatives, rows = comparison dimensions
│
├─ Has concepts that relate bidirectionally or form a network?
│   Example: "scope, variable, lifetime", "class, instance, method"
│   → kind: "graph"
│   Nodes = concepts, edges = named relationships
│
└─ Is the lesson primarily procedural / sequential?
    Example: "how a for-loop runs", "how a function call stack works"
    → kind: "flow"
    Steps mirror code_walkthrough order, one step per walkthrough entry
```

### 4.2 Quality Rules for AI-Generated Viz

The backend validates the viz using Pydantic discriminated unions. Beyond schema validation, the following quality rules should be enforced in the prompt:

1. **Every node must have `code_ref`** when any code in the lesson references it. Floating nodes with no code anchor reduce the bidirectional linking value.

2. **`flow` steps must mirror `code_walkthrough`** — the number of steps should equal or be a subset of `code_walkthrough.length`, with each step's `code_ref.walkthrough_index` matching its position in the walkthrough array.

3. **`table` columns must be 2-4** — fewer than 2 makes it a note, more than 4 overflows on all viewports.

4. **`graph` must have at least 1 edge** — a graph with no edges is a list of disconnected concepts, which should be a tree or list instead.

5. **`tree` must have a real root** — `root_id` must match a node `id` in `nodes`. Already enforced by the backend model validator indirectly (referenced children must exist in nodes).

### 4.3 Fallback Behavior

When `viz` is null or fails backend validation, the right panel falls back to:
1. `animation_frames` → AnimationPlayer (full panel width)
2. Neither → the "Synthesizing Logic Topology" loading state (Sparkles pulse)

This three-tier fallback is already implemented in `Learn.tsx` and is correct.

---

## 5. Animation & Transition System

### 5.1 Shared Motion Tokens

All motion in the system uses `framer-motion`. Establish these motion profiles for consistency:

| Profile     | Use case                              | Config |
|-------------|---------------------------------------|--------|
| `enter-up`  | Panels, modals, NodeDetail            | `initial: {opacity:0, y:8}` `animate: {opacity:1, y:0}` `duration: 0.15 ease:"easeOut"` |
| `enter-fade`| Tab content swap                      | `initial: {opacity:0}` `animate: {opacity:1}` `duration: 0.2` |
| `slide-lr`  | AnimationPlayer frame transitions     | `initial: {opacity:0, x:±20, filter:"blur(10px)"}` `duration: 0.4 ease:[0.16,1,0.3,1]` |
| `lift`      | Node hover (CSS, not framer)          | `-translate-y-[2px] transition-all duration-[120ms] ease-out` |
| `spring-bar`| Progress bars                         | `type:"spring" stiffness:300 damping:40` |

**`motion-reduce` override:** Every CSS transition in the codebase includes `motion-reduce:transition-none`. Ensure `AnimationPlayer` and `CodeWalkthrough` auto-play is disabled when `prefers-reduced-motion` is set:

```tsx
// In AnimationPlayer
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const [autoPlay, setAutoPlay] = useState(!prefersReduced);
```

### 5.2 Viz-specific Transitions

**ConceptTree & ConceptGraph (SVG nodes):**
- Hover lift: `transition-transform duration-[120ms] ease-out` on the `<g>` element (CSS, not framer)
- Active glow: instantaneous via SVG `filter` swap — already implemented
- Pin indicator: `<Pin>` icon appears inside `<foreignObject>` — no animation needed; it's a state indicator

**StepFlow pills:**
- Active state: `-translate-y-[2px] shadow-lg shadow-sky-900/30` via CSS transition `duration-[120ms]`
- Completion status change: should animate via CSS `transition-colors duration-300`

**ComparisonTable cells:**
- Code-linked elevation: `-translate-y-[2px] shadow-[0_4px_12px_-4px_rgba(56,189,248,0.4)]` — already implemented
- Column pin fade: `opacity-40` via `transition-all duration-150` — already implemented

**Tab content swaps:**
- Wrap tab panel content in `<AnimatePresence mode="wait">` with `enter-fade` profile
- Currently there is NO transition between tabs — content just appears. Add:

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={vizTab}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
    className="h-full"
  >
    {/* tab content */}
  </motion.div>
</AnimatePresence>
```

### 5.3 AnimationPlayer Frame Transitions

The existing slide-with-blur transition (`x: ±20, filter: "blur(10px)"`) is correct and cinematic. The direction signal (`dir: "forward" | "backward"`) is used correctly to determine slide direction. Keep this pattern.

**Checkpoint gate animation:** The `scale: 0.95 → 1` entrance with amber glow is correct. The exit uses `filter: "blur(8px)"` which is a satisfying "reveal" metaphor. Keep.

**Progress bar:** The absolute-positioned frame progress bar at `bottom-0` of the content area conflicts with the scrollable frame content. Move it to its own row between content and controls:

```tsx
// Between frame content div and controls footer:
{autoPlay && !isCheckpoint && (
  <div className="h-0.5 bg-slate-800 shrink-0">
    <div
      className="h-full bg-gradient-to-r from-fuchsia-500 via-sky-500 to-emerald-500"
      style={{ width: `${frameProgress}%`, transition: "none" }}
    />
  </div>
)}
```

---

## 6. Responsive & Accessibility Guidelines

### 6.1 Responsive Breakpoints

The lesson page uses a fixed 58%/42% split that works on `lg+` screens (`≥1024px`). At smaller sizes:

**`md` (768–1023px):** The right panel becomes too narrow for the SVG vizes. At `md`, collapse to a single-column stacked layout:
- Left column (content) takes full width
- Right panel (viz) becomes a fixed-height section below, `h-[360px]`
- The tab strip moves to the top of this section

```tsx
// In Learn.tsx layout
<div className="flex flex-1 min-h-0 overflow-hidden lg:flex-row flex-col">
  <div className="lg:w-[58%] w-full ...">  {/* content */} </div>
  <div className="lg:w-[42%] w-full lg:h-auto h-[360px] ..."> {/* viz */ }</div>
</div>
```

**`sm` (640–767px):**
- Chat FAB remains in bottom-right; chat panel becomes full-width `fixed inset-x-4 bottom-20`
- StepFlow switches to vertical stack layout
- Table horizontal scrolls (already handled)
- ConceptTree/Graph SVGs: add `min-w-[400px]` to the SVG to prevent collapse; the parent `overflow-auto` handles scroll

**`xs` (<640px, mobile):**
- CodeWalkthrough dot navigation: replace with numbered `<input type="range">` or arrow-button pair
- AnimationPlayer speed selector: move inside controls row as `[0.5x] [1x] [2x]` icon-only buttons
- NodeDetail: full width below viz, `max-h-[100px] overflow-y-auto`

### 6.2 WCAG AA Compliance Checks

All text/background combinations in the viz system must meet 4.5:1 minimum contrast ratio.

| Element                      | Text Token          | Background Token         | Est. Ratio | Status |
|------------------------------|---------------------|--------------------------|------------|--------|
| Active node label            | `text-sky-200`      | `bg-sky-500/15` on slate-950 | ~7.8:1 | Pass |
| Default node label           | `text-slate-200`    | `fill-slate-900/70` on slate-950 | ~13.5:1 | Pass |
| Node summary                 | `text-slate-400`    | `fill-slate-900/70`      | ~5.1:1 | Pass |
| Muted label (`text-slate-500`) | `text-slate-500` | `bg-slate-950`           | ~4.7:1 | Pass |
| Amber checkpoint heading     | `text-amber-400`    | `bg-amber-500/5` on slate-950 | ~6.2:1 | Pass |
| Code line highlight          | `text-sky-100`      | `bg-sky-500/[0.08]` on slate-950 | ~14.2:1 | Pass |
| Tab active                   | `text-sky-300`      | `bg-sky-500/15` on slate-950 | ~8.9:1 | Pass |
| Tab inactive                 | `text-slate-500`    | `bg-slate-950/40`        | ~4.7:1 | Pass (AA) |
| Table cell default           | `text-slate-300`    | `bg-slate-950/60`        | ~9.1:1 | Pass |

**Risk:** `text-slate-600` (used for inactive tab on hover `hover:text-slate-400`) on `bg-slate-950` is 3.1:1 — **fails AA**. The hover state is transient but still needs to pass. The transition destination `text-slate-400` (5.1:1) passes. Ensure the non-hover resting state is never `text-slate-600` for interactive text.

### 6.3 Keyboard Navigation Map

Full keyboard navigation flow through the right panel:

```
Tab → Tab Strip (tablist)
  ├─ Arrow Left/Right → Navigate tabs
  └─ Enter/Space → Select tab

Tab → Tab panel content
  ├─ "Concept" tab:
  │   ├─ Tab → First viz node
  │   ├─ Arrow keys → Navigate viz (tree/graph: directional; flow: left/right)
  │   ├─ Enter/Space → Toggle pin
  │   ├─ Escape → Clear all pins/hover (global handler in Learn.tsx) ✓
  │   └─ Tab → Jump to Code button (in NodeDetail, when visible)
  │
  ├─ "Code" tab:
  │   ├─ Tab → Code block dot nav buttons
  │   ├─ Arrow Left/Right → Previous/Next code block (add to CodePanel)
  │   └─ Tab → Code lines (if focusable — currently they are not; make them focusable)
  │
  └─ "Animation" tab:
      ├─ Tab → Play/Pause button
      ├─ Tab → Speed buttons
      ├─ Tab → Frame dot nav
      ├─ Tab → Back / Proceed buttons
      └─ Escape → Clear checkpoint (if at gate)
```

### 6.4 Focus Visibility

All interactive elements must have a visible focus ring. The project uses Tailwind's `focus-visible:ring-2 focus-visible:ring-sky-400` pattern. SVG `<g>` elements with `tabIndex={0}` need `outline: none` (prevent browser default) plus a custom SVG `<rect>` outline drawn when focused:

```tsx
// Inside the SVG g element, add a focus ring rect:
<rect
  width={NODE_W + 4}
  height={NODE_H + 4}
  x={-2}
  y={-2}
  rx={14}
  ry={14}
  fill="none"
  stroke="rgb(56 189 248)"   // sky-400
  strokeWidth={2}
  className="opacity-0 [g:focus-visible_&]:opacity-100 transition-opacity duration-100"
/>
```

This is cleaner than relying on browser outline on SVG elements, which is inconsistent across browsers.

---

## 7. Component Implementation Notes

### 7.1 Zustand Store — `lessonHighlight`

The store is the nervous system of the bidirectional linking. Its current shape:

```ts
{
  hoveredNodeId: string | null;    // viz → code: which node is hovered
  pinnedNodeId: string | null;     // viz → code: which node is pinned (click)
  hoveredCodeRef: CodeRef | null;  // code → viz: which code range is hovered
}
```

**Actions:**
- `setHovered(id)` — on mouse-enter of any viz node
- `togglePinned(id)` — on click of any viz node
- `setHoveredCode(ref)` — on mouse-enter of any code line
- `clear()` — on Escape key (global in Learn.tsx)

**No additions needed** — the current store shape handles all current and planned viz types. The table and flow components correctly use this store.

**Recommendation:** Add a `resetOnTabChange` call in `Learn.tsx` when `vizTab` changes, to prevent stale pins from persisting across tab switches:

```tsx
// In Learn.tsx, when setVizTab is called:
const handleTabChange = (tab: typeof vizTab) => {
  clearHighlight();
  setVizTab(tab);
};
```

### 7.2 Component Boundaries

```
Learn.tsx (page, owns: vizTab state, currentWalkthroughIndex, currentFrame)
│
├─ [Right Panel]
│   ├─ Tab strip (inline in Learn.tsx — acceptable, it's simple)
│   │
│   ├─ [Concept tab]
│   │   ├─ LessonViz.tsx (pure dispatcher, no state)
│   │   │   ├─ ConceptTree.tsx (owns: focusedId)
│   │   │   ├─ ConceptGraph.tsx (stateless beyond refs)
│   │   │   ├─ ComparisonTable.tsx (owns: pinnedCol)
│   │   │   └─ StepFlow.tsx (stateless)
│   │   └─ NodeDetail.tsx (reads from lessonHighlight store)
│   │
│   ├─ [Code tab]
│   │   └─ CodePanel.tsx (reads/writes lessonHighlight store)
│   │
│   └─ [Animation tab]
│       └─ AnimationPlayer.tsx (owns: idx, dir, autoPlay, speed, frameProgress)
│           ├─ CanvasScene.tsx
│           └─ DataViewRenderer.tsx
│               ├─ ArrayView
│               ├─ VarsView
│               ├─ ObjectView
│               ├─ StackView
│               └─ QueueView
```

### 7.3 Type Safety Notes

The `Viz` discriminated union in `types/index.ts` is correctly typed. `LessonViz.tsx` uses a `switch (viz.kind)` that TypeScript narrows to the correct variant in each branch. This pattern is correct — do not change it.

`ComparisonTable` does not use `VizNode` nodes, so it does not participate in `lessonHighlight.hoveredNodeId`. It links only via `hoveredCodeRef`. This is correct — do not add node-based hover to table rows.

### 7.4 Tailwind Patterns — Reuse Checklist

Before writing new classes, verify these established patterns are used consistently:

| Pattern | Classes |
|---------|---------|
| Section label | `text-[10px] font-bold uppercase tracking-widest text-slate-500` |
| Active accent | `bg-sky-500/15 border-sky-500/30 text-sky-300` |
| Pinned indicator | `stroke-sky-400 strokeWidth={2}` + `<Pin className="h-3.5 w-3.5 text-sky-300" />` |
| Why/insight block | `border-amber-500/20 bg-amber-500/5 rounded-xl px-3 py-2.5` + `<Zap text-amber-400>` |
| Glass panel | `bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 rounded-2xl` |
| Monospace code | `font-mono text-sm leading-6 text-slate-400` |
| Glow filter | SVG `<filter id="*-glow">` with `feGaussianBlur stdDeviation="3"` + merge |
| Focus ring | `focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950` |
| Transition standard | `transition-all duration-[120ms] ease-out motion-reduce:transition-none` |

### 7.5 Implementation Priority Order

For a frontend developer implementing from this spec, the recommended sequencing:

1. **Fix accessibility gaps in existing components** (scope, aria-label, focus rings on SVG nodes) — low effort, high impact, no visual changes
2. **Add `completedUpTo` prop to StepFlow** — small prop addition, emerald state for completed steps
3. **Add tab strip animation** (AnimatePresence on tab content swap) — 10 lines, big perceived quality improvement
4. **Fix `resetOnTabChange`** — prevents confusing stale pin state
5. **Add `prefers-reduced-motion` guard to auto-play** — accessibility requirement
6. **Implement syntax highlighting in CodePanel** — highest implementation complexity, but significant pedagogical value
7. **Responsive layout changes** (`md`/`sm` breakpoints for panel split) — significant layout work, lower priority if mobile is not primary target
8. **Active edge highlighting in ConceptGraph** — moderate complexity, good polish
9. **Root node distinct styling in ConceptTree** — minor visual change
10. **DataView status color tokens** — ensure all status variants are styled per Section 3.5 spec

---

## Appendix A: ASCII Wireframe — Full Lesson Page

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [← Exit Space]  |  Lesson Title   [TOPIC]        Completion: 42% ████░░░░░░░  │
│ ─────────────────────────────────── progress bar ─────────────────────────────  │
├──────────────────────────────────────┬──────────────────────────────────────────┤
│                                      │  [Concept] [Code] [Animation]            │
│  CONCEPT HOOK                        ├──────────────────────────────────────────┤
│  ┌────────────────────────────────┐  │                                          │
│  │ ✦ Hook text here...            │  │  [Concept tab active]                    │
│  └────────────────────────────────┘  │  ┌──────────────────────────────────┐   │
│                                      │  │  ConceptTree SVG                  │   │
│  CONCEPTUAL TARGETS                  │  │  (scrollable, interactive nodes)  │   │
│  [concept] [concept] [concept]       │  └──────────────────────────────────┘   │
│                                      │  ┌──────────────────────────────────┐   │
│  ARCHITECTURAL INSIGHT               │  │ ◈ NodeDetail (pinned)            │   │
│  ┌──────────────┐ ┌──────────────┐   │  │ Function Definition              │   │
│  │ ⚡ Card 1    │ │ 🧠 Card 2   │   │  │ Defines a reusable block...      │   │
│  └──────────────┘ └──────────────┘   │  │                        [Jump →]  │   │
│                                      │  └──────────────────────────────────┘   │
│  IMPLEMENTATION WALKTHROUGH          │                                          │
│  ┌────────────────────────────────┐  │                                          │
│  │ CodeWalkthrough component      │  │                                          │
│  │ code | explanation             │  │                                          │
│  └────────────────────────────────┘  │                                          │
│                                      │                                          │
│  MASTERY CHALLENGE                   │                                          │
│  ┌────────────────────────────────┐  │                                          │
│  │ "Ready to apply this?"         │  │                                          │
│  │              [Start Workshop →]│  │                                          │
│  └────────────────────────────────┘  │                                          │
│                                      │                                          │
├──────────────────────────────────────┴──────────────────────────────────────────┤
│                                                             [💬 FAB]            │
│                                              ┌──────────────────────────┐      │
│                                              │ AI Mentor  [Live ●] [X]  │      │
│                                              │ ── Depth: Q|C|D|E ──    │      │
│                                              │ [messages]               │      │
│                                              │ [textarea] [→]           │      │
│                                              └──────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix B: Viz Kind → Content Scenario Matrix

| Lesson Topic Example               | Recommended Viz | Steps/Nodes | Notes |
|------------------------------------|-----------------|-------------|-------|
| Function anatomy                   | `tree`          | 4–6 nodes   | Root: function; children: name, params, body, return |
| For-loop execution                 | `flow`          | 4–6 steps   | Mirror code_walkthrough exactly |
| List vs. tuple                     | `table`         | 2 columns   | Rows: mutability, syntax, use case, performance |
| Variable scope (local vs global)   | `graph`         | 3–4 nodes   | Edge labels: "shadows", "accesses", "modifies" |
| If/elif/else branching             | `flow`          | 3–5 steps   | One step per branch condition check |
| Class and its members              | `tree`          | 5–7 nodes   | Root: class; children: attributes, methods, __init__ |
| List comprehension parts           | `tree`          | 4 nodes     | Root: comprehension; children: expression, for, if |
| Mutable vs immutable types         | `table`         | 4 columns   | list, tuple, str, int |
| Import system                      | `graph`         | 4–6 nodes   | Module, namespace, object with relationship edges |
| Recursion call stack               | `flow`          | 5–7 steps   | Each step = one recursive call level |
