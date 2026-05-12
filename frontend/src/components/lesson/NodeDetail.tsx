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
  const pinnedNodeId = useLessonHighlight((s) => s.pinnedNodeId);

  const nodes = useMemo(() => getNodes(viz), [viz]);
  const node = nodes.find((n) => n.id === pinnedNodeId) ?? null;

  return (
    <AnimatePresence mode="wait">
      {node && (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="rounded-2xl border border-sky-500/40 bg-slate-900/98 p-6 shadow-2xl shadow-black/80 backdrop-blur-xl relative overflow-hidden"
          role="status"
          aria-live="polite"
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.5)]" />
          
          <div className="flex items-start justify-between gap-8">
            <div className="min-w-0 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-400 flex items-center gap-2">
                <Pin className="h-3.5 w-3.5" />
                Conceptual Analysis
              </p>
              <h4 className="text-xl font-black text-white tracking-tight">
                {node.label}
              </h4>
              {node.summary && (
                <p className="text-sm leading-relaxed text-slate-200 font-medium max-w-2xl">
                  {node.summary}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 shrink-0">
              {node.code_ref && onJumpToCode && (
                <button
                  type="button"
                  onClick={() => onJumpToCode(node.code_ref!.walkthrough_index)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-sky-500 transition-all shadow-lg shadow-sky-900/40"
                >
                  View Code
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-800/40 px-3 py-1.5 rounded-lg border border-slate-700/50">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                Live Hook
              </div>
            </div>
          </div>
          
          {node.code_ref && (
            <div className="mt-5 pt-4 border-t border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Execution Mapping</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-[10px] font-mono font-bold text-sky-400 border border-slate-700">
                  Step {node.code_ref.walkthrough_index + 1}
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-600">
                Source: Line {node.code_ref.line_start}{node.code_ref.line_end !== node.code_ref.line_start ? `–${node.code_ref.line_end}` : ""}
              </span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
