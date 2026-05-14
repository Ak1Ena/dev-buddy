# Frontend & Interaction Architecture

## 1. Frontend Architecture
The frontend is a **Single Page Application (SPA)** built with React, TypeScript, and Vite. It is designed as a "Player" rather than a "Chatbot".

### Core Subsystems:
- **Cinematic Engine:** Interprets Scene JSON. It contains:
    - **Timeline Controller:** Handles play/pause, seeking, and speed. It manages the `currentTime` global state.
    - **Primitive Factory:** Maps JSON types (e.g., `particle`, `box`) to React components (Framer Motion).
    - **Sync Engine:** Ensures narration (Text-to-Speech or subtitles) stays aligned with visual beats.
- **Code Panel:** A Monaco or Shiki-based viewer that supports "Deep Linking". The Engine can send commands to highlight lines `X-Y` during specific timeline segments.
- **Socratic Sidebar:** The interaction layer where the AI Mentor asks questions. This is decoupled from the main animation but can pause the timeline at "Discovery Gates".

## 2. State Management Strategy
We use **Zustand** for its simplicity and performance in high-frequency update scenarios (like animation sync).

### Store Modules:
1. **`useTimelineStore`**: 
    - `currentTime: number`
    - `isPlaying: boolean`
    - `duration: number`
    - `seekTo(time: number)`
2. **`useSceneStore`**:
    - `currentScene: SceneJSON`
    - `activePrimitives: PrimitiveID[]`
    - `discoveryGateReached: boolean` (Pauses playback until user interacts)
3. **`useCodeHighlightStore`**:
    - `highlightedLines: number[]`
    - `currentFile: string`

### The "Reactive Loop":
The `useTimelineStore`'s `currentTime` is the heart of the engine. Every frame (via `requestAnimationFrame`), components check if they should be visible or performing an action based on:
`primitive.start <= currentTime && currentTime <= (primitive.start + primitive.duration)`
