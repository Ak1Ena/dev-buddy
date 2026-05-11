import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Pin } from "lucide-react";
import type { Viz, VizNode } from "@/types";
import { useLessonHighlight } from "@/store/lessonHighlight";

interface Props {
  viz?: Viz;
  /** Called with the node's code_ref walkthrough_index when "Jump to code" is clicked. */
  onJumpToCode?: (walkthroughIndex: number) => void;
}

function getNodes(viz: Viz | undefined): VizNode[] {
  if (!viz) return [];
  if (viz.kind === "tree" || viz.kind === "graph") return viz.nodes;
  if (viz.kind === "flow") return viz.steps;
  return [];
}

export default function NodeDetail({ viz, onJumpToCode }: Props) {
  const hoveredNodeId = useLessonHighlight((s) => s.hoveredNodeId);
  const pinnedNodeId = useLessonHighlight((s) => s.pinnedNodeId);

  const nodes = useMemo(() => getNodes(viz), [viz]);
  const id = pinnedNodeId ?? hoveredNodeId;
  const node = nodes.find((n) => n.id === id) ?? null;
  const isPinned = !!pinnedNodeId && node?.id === pinnedNodeId;

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="rounded-xl border border-sky-500/30 bg-slate-900/90 p-4 shadow-lg shadow-sky-900/20 backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400 mb-1 flex items-center gap-1.5">
                {isPinned && <Pin className="h-3 w-3" />}
                {isPinned ? "Pinned" : "Concept"}
              </p>
              <h4 className="text-sm font-bold text-white tracking-tight">
                {node.label}
              </h4>
              {node.summary && (
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  {node.summary}
                </p>
              )}
            </div>
            {node.code_ref && onJumpToCode && (
              <button
                type="button"
                onClick={() => onJumpToCode(node.code_ref!.walkthrough_index)}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-300 hover:bg-sky-500/20 transition-colors"
              >
                Jump to code
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
          {node.code_ref && (
            <p className="mt-2 text-[10px] font-mono text-slate-500">
              Block {node.code_ref.walkthrough_index + 1} · lines {node.code_ref.line_start}
              {node.code_ref.line_end !== node.code_ref.line_start
                ? `–${node.code_ref.line_end}`
                : ""}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
