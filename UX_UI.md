# devBuddy AI — UX/UI Design Specifications
Version: 1.0.0
Aesthetic: **Cybernetic Senior Mentor** (High-fidelity, dark-themed, data-driven, cinematic)

---

## 🎨 1. Core Visual Language

### Semantic Logic Colors (Mandated)
These colors MUST be used consistently to represent specific logic types in graphs, animations, and text highlights.

| Type | Color | Hex Code | Tailwind Class | Use Case |
|---|---|---|---|---|
| **Decision** | Fuchsia | `#D946EF` | `text-fuchsia-500` | `if`, `switch`, loops, logic branches |
| **Action** | Sky | `#0EA5E9` | `text-sky-500` | Assignments, function calls, transformations |
| **Outcome** | Emerald | `#10B981` | `text-emerald-500` | `return`, success states, final results |
| **Checkpoint**| Amber | `#F59E0B` | `text-amber-500` | Active discovery, prediction prompts |

### Base Palette
- **Background**: `#020617` (Slate 950)
- **Surface (Glass)**: `rgba(15, 23, 42, 0.6)` (Slate 900 with 60% opacity)
- **Border**: `rgba(51, 65, 85, 0.4)` (Slate 700 with 40% opacity)
- **Accent Glow**: Sky 500/30 for interactive elements.

---

## 🏛 2. Vertical Visual Stack (VVS) Layout

The layout is split vertically to separate the "Dynamic Logic" from the "Static Content/Dialogue".

### A. The "Hero Logic Map" (Top 45-48%)
- **Purpose**: High-level spatial visualization of the logic.
- **Visual Style**: Mesh gradient background (`bg-slate-950` with subtle `radial-gradient` of Sky/Fuchsia at corners).
- **Graph Priority**: Prioritize Flowcharts/State Machines over raw code.
- **Cinematic Feel**: Smooth transitions between frames (Framer Motion `layoutId`).

### B. The "Mastery Workspace" (Bottom 52-55%)
Split into two columns:
1. **Left (58%): Technical Deep Dive**
   - High-contrast typography.
   - Glassmorphism cards for sections.
   - Scrollable area with "Reading Progress" synced to the top logic map.
2. **Right (42%): Socratic Dialogue**
   - Darker background than the left column to provide focus.
   - Real-time "Thinking" states for the AI.
   - Segmented message types (MD, Feedback, Animation controls).

---

## 🧩 3. Component Specifications

### 3.1. Prediction Checkpoints (The "Discovery Gate")
*Requirement: Force active discovery before revealing outcome.*

- **UI**: A full-overlay or significant centered card that interrupts the animation.
- **Glassmorphism**: `backdrop-blur-xl bg-amber-500/5 border-amber-500/20`.
- **Interaction**:
    - The "Proceed" button in the `AnimationPlayer` is locked.
    - A "Prediction Required" pulse effect in the Amber color.
    - **The Twist**: Instead of just a "Reveal" button, show a "Hypothesize in Chat" hint or a set of multiple-choice prediction bubbles.
- **Success State**: When cleared, the card dissolves with a "Burst Transition" (Emerald glow).

### 3.2. Logic Nodes (Canvas Scene)
- **Decision Nodes**: Diamond shape, Fuchsia border, subtle inner glow.
- **Action Nodes**: Rounded rectangle, Sky border.
- **Outcome Nodes**: Pill shape, Emerald border.
- **Edges**: Animated "Flow" effect (marching ants or glowing pulse) showing data movement.

### 3.3. AI Mentor Chat
- **Bubbles**: 
    - User: Sky-600 background, sharp bottom-right corner.
    - AI: Glass-panel (Slate 800/60 blur), sharp bottom-left corner.
- **Socratic Depth Selector**: A high-fidelity segmented control at the top of the chat to switch between Question, Concept, Direction, and Example levels.

---

## ✨ 4. Styling & Effects

### Glassmorphism Utility
```css
.glass-panel {
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(51, 65, 85, 0.4);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}
```

### Mesh Gradient (Tailwind/CSS)
```css
.mesh-gradient {
  background-color: #020617;
  background-image: 
    radial-gradient(at 0% 0%, rgba(14, 165, 233, 0.15) 0px, transparent 50%),
    radial-gradient(at 100% 0%, rgba(217, 70, 239, 0.1) 0px, transparent 50%),
    radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.05) 0px, transparent 50%);
}
```

### Interactive Feedback
- **Pulse**: Use for variables that just changed value.
- **Spawn**: Scale 0 -> 1.1 -> 1 for new nodes.
- **Focus**: When a concept in the "Deep Dive" is hovered, the corresponding node in the "Hero Logic Map" should glow.

---

## 📱 5. Responsive Strategy

- **Desktop**: Side-by-side workspace (as described).
- **Tablet (Vertical)**: Hero Map at top, Bottom workspace tabs (Deep Dive vs. Chat).
- **Mobile**: Full-screen Hero Map toggleable, scrolling vertical stack for content.

---

## 🛠 6. Implementation Notes for @frontend

1. **Framer Motion**: Use `AnimatePresence` for all frame transitions in `AnimationPlayer.tsx`.
2. **Typography**: Use a modern sans-serif (e.g., Inter or Geist) for body text and a high-quality mono (e.g., JetBrains Mono) for code/logic.
3. **Scroll Sync**: Implement a hook that detects which `Section` is in view in the `Deep Dive` and highlights relevant frames in the `AnimationPlayer`.
4. **Active Discovery**: Update the `Checkpoint` component in `AnimationPlayer.tsx` to include an optional `PredictionOptions` array that, when selected, triggers the "Reveal Discovery" action.
