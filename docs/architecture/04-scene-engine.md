# Scene Generation & Rendering Engine

## 1. Scene Generation Pipeline
The backend transforms code into a choreographed scene through four distinct stages.

### Stage 1: Structural Extraction (AST Analysis)
- **Tool:** `libcst` or Python `ast`.
- **Action:** Convert source code into a Syntax Tree.
- **Output:** A map of declarations, assignments, and control flow nodes with precise location data.

### Stage 2: Logical Topology Mapping
- **Action:** Flatten the AST into "Atomic Steps". For example, a `for` loop becomes: `Initialize -> [Check -> Body -> Increment] -> Exit`.
- **Metadata:** Attach "Pedagogical Weights" to steps (e.g., a memory mutation is "Heavy/Cinematic", a simple increment is "Light/Fast").

### Stage 3: Choreography Generation (The AI Agent)
- **Action:** The AI Agent iterates through the Topology and decides which **Primitives** to use to explain each step.
- **Rules:**
    - Use `particle` for data transfer.
    - Use `vibrate` for errors.
    - Use `pulse` to draw attention to a changing variable.
- **Timing:** AI calculates `start` and `duration` based on the complexity of the step and the speed of the narration.

### Stage 4: Timeline Compression & Validation
- **Action:** Pack overlapping primitives to maximize screen real estate.
- **Check:** Ensure no "Discovery Gate" occurs while other animations are in progress.

## 2. Timeline Engine Design
The Timeline Engine lives on the Frontend and acts as the "Director".

- **Global Clock:** A single `requestAnimationFrame` loop that drives the `currentTime`.
- **Layered Playback:**
    - **Logic Layer:** Coordinates primitives.
    - **Narration Layer:** Triggers voice/subtitles.
    - **Interaction Layer:** Pauses the clock when a `gate` type primitive is active.
- **Scrubbing & Seeking:** Because the Scene JSON is declarative, seeking is simply a filter of `timeline.filter(p => p.start <= currentTime)`.

## 3. Renderer Engine Design
The Renderer is a **Primitive Factory** that maps JSON to visual components.

- **Component Registry:** A dictionary mapping `type` (e.g., `box`) to a React component.
- **Animation Strategy:**
    - Components use the `currentTime` to drive their own internal `useAnimation` hooks.
    - **Performance:** Low-priority primitives (labels) use standard CSS/DOM; high-priority primitives (particle systems) use **Canvas/WebGL**.

### Primitive Definition (The 15+ Core Primitives)
1.  **`box`**: Represents a memory slot or variable.
2.  **`label`**: Annotations and floating text.
3.  **`arrow`**: Indicates pointers or references.
4.  **`particle`**: Represents data packets moving between nodes.
5.  **`pulse`**: A glow effect to emphasize an element.
6.  **`move`**: Interpolates an element between two positions.
7.  **`fade`**: Controls visibility/opacity.
8.  **`scale`**: Changes the size of an element (e.g., expanding a heap block).
9.  **`color`**: Interpolates colors (e.g., changing from "Active" to "Error").
10. **`code_highlight`**: Sends a message to the Code Panel to highlight lines.
11. **`gate`**: An interactive pause point requiring user input.
12. **`vibrate`**: A haptic/visual shake for errors or collisions.
13. **`audio`**: A trigger for a sound effect or narration start.
14. **`group`**: Logical grouping for mass transformations.
15. **`stack_node`**: Special primitive for LIFO memory representation.
16. **`heap_node`**: Special primitive for fragmented/dynamic memory.
