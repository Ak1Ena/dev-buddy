# Strategy, Scalability & Roadmap

## 1. Framer Motion Integration Strategy
Framer Motion is our primary tool for "Declarative Choreography".

- **The `AnimatePresence` Pattern:** We use `AnimatePresence` to handle the mounting/unmounting of primitives as the `currentTime` scrubs through the `start` and `duration` windows.
- **Custom `PrimitiveWrapper`**:
    ```tsx
    const PrimitiveWrapper = ({ primitive }) => {
      const { currentTime } = useTimelineStore();
      const isActive = currentTime >= primitive.start && currentTime <= primitive.start + primitive.duration;

      return (
        <motion.div
          animate={isActive ? "visible" : "hidden"}
          variants={primitiveVariants[primitive.type]}
          transition={{ duration: primitive.duration }}
        >
          <PrimitiveComponent {...primitive.props} />
        </motion.div>
      );
    };
    ```
- **Performance:** Use `layout` prop for smooth position transitions between steps and `useReducedMotion` to satisfy accessibility requirements.

## 2. Scalability Recommendations
- **Scene Caching:** Hash the input code + detected concept. Store the generated `Scene JSON` in Redis/PostgreSQL to avoid redundant AI costs for common snippets.
- **Lazy Loading Primitives:** Only load the component code for primitives present in the current scene.
- **Edge Functions:** Deploy the AST Parser to the edge (e.g., Vercel Functions) to reduce latency for initial structural analysis.

## 3. MVP Implementation Order
1.  **Stage 1: The Contract (Week 1)**
    - Finalize `Scene JSON` Schema.
    - Implement the `Primitive Factory` on the frontend with 3 basic primitives (`box`, `label`, `pulse`).
2.  **Stage 2: Structural Analysis (Week 2)**
    - Integrate `libcst` into the backend.
    - Create a deterministic "AST to Basic Scene" converter (no AI).
3.  **Stage 3: AI Choreography (Week 3)**
    - Implement the `Scene Choreographer` Agent.
    - Fine-tune prompts to generate valid timing and primitive selection.
4.  **Stage 4: Cinematic Polish (Week 4)**
    - Add advanced primitives (`particle`, `vibrate`, `gate`).
    - Implement the `Timeline Controller` (Scrubbing/Sync).

## 4. Future Extensibility Recommendations
- **Multi-File Analysis:** Extend the AST parser to handle imports and cross-file dependencies.
- **Live Debugger Integration:** Connect the engine to a real debugger (e.g., `debugpy` for Python) to generate scenes from real-time production data.
- **Community Primitives:** Allow users to define their own visualization primitives using a standardized API.
- **VR/AR Export:** Since the scene is declarative, it can be exported to OpenXR formats for immersive learning.
