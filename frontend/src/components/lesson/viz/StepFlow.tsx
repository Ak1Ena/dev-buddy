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
      className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 overflow-x-auto py-2"
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
          <div key={step.id} className="flex flex-col sm:flex-row items-center gap-2">
            <button
              type="button"
              data-step-id={step.id}
              aria-label={aria}
              aria-pressed={isPinned}
              aria-current={isCurrent ? "step" : undefined}
              onMouseEnter={() => setHovered(step.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => {
                togglePinned(step.id);
                if (step.code_ref) onStepActivate?.(step.code_ref.walkthrough_index);
              }}
              onFocus={() => setHovered(step.id)}
              onBlur={() => setHovered(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  togglePinned(step.id);
                  if (step.code_ref) onStepActivate?.(step.code_ref.walkthrough_index);
                }
              }}
              className={cn(
                "group relative flex min-h-[32px] min-w-[44px] w-full sm:w-auto items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-[120ms] ease-out motion-reduce:transition-none",
                active
                  ? "border-sky-400 bg-sky-500/15 text-sky-200 -translate-y-[2px] shadow-lg shadow-sky-900/30"
                  : isCompleted
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-700/60 bg-slate-900/40 text-slate-300 hover:-translate-y-[2px] hover:border-slate-500 hover:bg-slate-800/60"
              )}
            >
              <span className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                active ? "bg-sky-400 text-slate-950" : isCompleted ? "bg-emerald-400 text-slate-950" : "bg-slate-800 text-slate-400"
              )}>
                {i + 1}
              </span>
              <span className="whitespace-nowrap">{step.label}</span>
              {isPinned && <Pin className="h-3 w-3 text-sky-300" />}
            </button>
            {i < steps.length - 1 && (
              <>
                <ChevronRight className="hidden sm:block h-4 w-4 shrink-0 text-slate-700" aria-hidden />
                <ChevronDown className="block sm:hidden h-4 w-4 shrink-0 text-slate-700 self-center" aria-hidden />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
