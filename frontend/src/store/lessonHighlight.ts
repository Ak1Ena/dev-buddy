import { create } from "zustand";
import type { CodeRef } from "@/types";

interface LessonHighlightStore {
  hoveredNodeId: string | null;
  pinnedNodeId: string | null;
  /** When the user hovers a code line, mirror it back to the viz. */
  hoveredCodeRef: CodeRef | null;

  setHovered: (id: string | null) => void;
  setPinned: (id: string | null) => void;
  togglePinned: (id: string) => void;
  setHoveredCode: (ref: CodeRef | null) => void;
  clear: () => void;
}

export const useLessonHighlight = create<LessonHighlightStore>((set, get) => ({
  hoveredNodeId: null,
  pinnedNodeId: null,
  hoveredCodeRef: null,

  setHovered: (id) => set({ hoveredNodeId: id }),
  setPinned: (id) => set({ pinnedNodeId: id }),
  togglePinned: (id) =>
    set({ pinnedNodeId: get().pinnedNodeId === id ? null : id }),
  setHoveredCode: (ref) => set({ hoveredCodeRef: ref }),
  clear: () =>
    set({ hoveredNodeId: null, pinnedNodeId: null, hoveredCodeRef: null }),
}));

/**
 * Returns true if the two code refs overlap (same walkthrough_index and any
 * line overlap). Used by viz nodes to lift when a code line is hovered.
 */
export function codeRefOverlaps(a?: CodeRef | null, b?: CodeRef | null): boolean {
  if (!a || !b) return false;
  if (a.walkthrough_index !== b.walkthrough_index) return false;
  return !(a.line_end < b.line_start || b.line_end < a.line_start);
}
