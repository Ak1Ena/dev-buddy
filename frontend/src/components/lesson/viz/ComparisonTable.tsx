import { useState } from "react";
import { Pin } from "lucide-react";
import type { VizTableRow, CodeRef } from "@/types";
import { useLessonHighlight, codeRefOverlaps } from "@/store/lessonHighlight";
import { cn } from "@/lib/utils";

interface Props {
  columns: string[];
  rows: VizTableRow[];
}

export default function ComparisonTable({ columns, rows }: Props) {
  const [pinnedCol, setPinnedCol] = useState<number | null>(null);
  const hoveredCodeRef = useLessonHighlight((s) => s.hoveredCodeRef);
  const setHoveredCode = useLessonHighlight((s) => s.setHoveredCode);

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-600 text-sm">
        No comparison data available
      </div>
    );
  }

  const cellId = (r: number, c: number) => `cmp-${r}-${c}`;

  return (
    <div className="relative overflow-x-auto rounded-xl border border-slate-800/60 bg-slate-900/30 after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-8 after:bg-gradient-to-l after:from-slate-900/90 after:to-transparent">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 bg-slate-900/80 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500"
            />
            {columns.map((col, i) => {
              const faded = pinnedCol !== null && pinnedCol !== i;
              return (
                <th
                  key={i}
                  scope="col"
                  role="button"
                  tabIndex={0}
                  onClick={() => setPinnedCol(pinnedCol === i ? null : i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPinnedCol(pinnedCol === i ? null : i);
                    }
                  }}
                  className={cn(
                    "cursor-pointer select-none px-4 py-3 text-left text-xs font-bold uppercase tracking-wider transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
                    pinnedCol === i
                      ? "bg-sky-500/10 text-sky-300 border-b-2 border-sky-400"
                      : faded
                      ? "text-slate-600 opacity-50"
                      : "text-slate-300 hover:text-sky-300 border-b border-slate-800"
                  )}
                  aria-pressed={pinnedCol === i}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col}</span>
                    {pinnedCol === i && <Pin className="h-3 w-3 text-sky-300" />}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="group">
              <th
                scope="row"
                className={cn(
                  "sticky left-0 z-10 bg-slate-950/60 px-4 py-3 text-xs font-bold tracking-wide text-slate-300 border-b border-slate-800/50 text-left",
                  "group-hover:bg-slate-900/80"
                )}
              >
                {row.label}
              </th>
              {row.cells.map((cell, ci) => {
                const ref: CodeRef | undefined = cell.code_ref;
                const linked = codeRefOverlaps(hoveredCodeRef, ref);
                const faded = pinnedCol !== null && pinnedCol !== ci;
                return (
                  <td
                    key={ci}
                    id={cellId(ri, ci)}
                    onMouseEnter={() => ref && setHoveredCode(ref)}
                    onMouseLeave={() => setHoveredCode(null)}
                    className={cn(
                      "px-4 py-3 text-sm leading-relaxed border-b border-slate-800/40 transition-all duration-[120ms] ease-out motion-reduce:transition-none",
                      faded ? "opacity-40" : "opacity-100",
                      ref ? "cursor-pointer" : "",
                      linked
                        ? "bg-sky-500/10 text-sky-200 -translate-y-[2px] shadow-[0_4px_12px_-4px_rgba(56,189,248,0.4)]"
                        : "text-slate-300 hover:bg-slate-800/40 hover:text-slate-100 hover:-translate-y-[2px]"
                    )}
                    aria-label={ref ? `${cell.value}, lines ${ref.line_start}-${ref.line_end}` : cell.value}
                  >
                    {cell.value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
