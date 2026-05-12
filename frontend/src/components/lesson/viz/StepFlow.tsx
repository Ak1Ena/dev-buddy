import { useEffect, useRef } from "react";
import { ChevronRight, ChevronDown, Pin } from "lucide-react";
import type { VizNode } from "@/types";
import { useLessonHighlight, codeRefOverlaps } from "@/store/lessonHighlight";
import { cn } from "@/lib/utils";

interface Props {
  steps: VizNode[];
  /** When a step is clicked, sync the walkthrough panel to its code_ref's index. */
  onStepActivate?: (walkthroughIndex: number | undefined) => void;
  /** Walkthrough index of the currently active code block — steps before this index show as completed. */
  completedUpTo?: number;
}

export default function StepFlow({ steps, onStepActivate, completedUpTo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hoveredNodeId = useLessonHighlight((s) => s.hoveredNodeId);
  const pinnedNodeId = useLessonHighlight((s) => s.pinnedNodeId);
  const hoveredCodeRef = useLessonHighlight((s) => s.hoveredCodeRef);
  const setHovered = useLessonHighlight((s) => s.setHovered);
  const togglePinned = useLessonHighlight((s) => s.togglePinned);

  // Keyboard nav across the flow when focus is inside the container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handle = (e: KeyboardEvent) => {
      if (!el.contains(document.activeElement)) return;
      const idx = steps.findIndex((s) => s.id === document.activeElement?.getAttribute("data-step-id"));
      if (idx === -1) return;
      let next = idx;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = Math.max(0, idx - 1);
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") next = Math.min(steps.length - 1, idx + 1);
      else return;
      e.preventDefault();
      const target = el.querySelector<HTMLElement>(
        `[data-step-id="${steps[next].id}"]`
      );
      target?.focus();
    };
    el.addEventListener("keydown", handle);
    return () => el.removeEventListener("keydown", handle);
  }, [steps]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-4 overflow-x-auto p-8 h-full"
    >
      {steps.map((step, i) => {
        const isHovered = hoveredNodeId === step.id;
        const isPinned = pinnedNodeId === step.id;
        const linked = codeRefOverlaps(hoveredCodeRef, step.code_ref);
        const active = isHovered || isPinned || linked;
        const isCompleted =
          step.code_ref?.walkthrough_index !== undefined &&
          step.code_ref.walkthrough_index < (completedUpTo ?? -1);
        const isCurrent =
          step.code_ref?.walkthrough_index !== undefined &&
          step.code_ref.walkthrough_index === completedUpTo;
        const aria = [
          `Step ${i + 1}`,
          step.label,
          step.summary,
          step.code_ref ? `lines ${step.code_ref.line_start}-${step.code_ref.line_end}` : "",
        ]
          .filter(Boolean)
          .join(", ");
        return (
          <div key={step.id} className="flex flex-col sm:flex-row items-center gap-4">
            <button
              type="button"
              data-step-id={step.id}
              aria-label={aria}
              aria-pressed={isPinned}
              aria-current={isCurrent ? "step" : undefined}
              onClick={() => {
                togglePinned(step.id);
                if (step.code_ref) onStepActivate?.(step.code_ref.walkthrough_index);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  togglePinned(step.id);
                  if (step.code_ref) onStepActivate?.(step.code_ref.walkthrough_index);
                }
              }}
              className={cn(
                "group relative flex min-h-[44px] min-w-[120px] w-full sm:w-auto items-center gap-3 rounded-2xl border px-5 py-3 text-sm font-bold transition-all duration-200 shadow-xl",
                active
                  ? "border-sky-400 bg-sky-500/20 text-white -translate-y-1 shadow-sky-900/40"
                  : isCompleted
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-700/80 bg-slate-900/60 text-slate-200 hover:-translate-y-1 hover:border-slate-500 hover:bg-slate-800"
              )}
            >
              <span className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-black tabular-nums shadow-inner",
                active ? "bg-sky-400 text-slate-950" : isCompleted ? "bg-emerald-400 text-slate-950" : "bg-slate-800 text-slate-400 border border-slate-700"
              )}>
                {i + 1}
              </span>
              <span className="whitespace-nowrap tracking-tight">{step.label}</span>
              {isPinned && <Pin className="h-4 w-4 text-sky-300" />}
            </button>
            {i < steps.length - 1 && (
              <>
                <ChevronRight className="hidden sm:block h-5 w-5 shrink-0 text-slate-700" aria-hidden />
                <ChevronDown className="block sm:hidden h-5 w-5 shrink-0 text-slate-700 self-center" aria-hidden />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
