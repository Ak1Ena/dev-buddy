import { motion, AnimatePresence } from "framer-motion";
import type { DataView, DataStatus, ArrayCell, ArrayCursor, VarRow, ListItem } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<DataStatus, { cell: string; text: string; ring: string }> = {
  filled:  { cell: "bg-sky-500/10  border-sky-500/40",       text: "text-sky-200",       ring: "ring-sky-500/30" },
  empty:   { cell: "bg-slate-900/50 border-slate-800",       text: "text-slate-600",     ring: "ring-slate-700/30" },
  active:  { cell: "bg-amber-500/15 border-amber-400/60",    text: "text-amber-200",     ring: "ring-amber-400/40" },
  updated: { cell: "bg-emerald-500/15 border-emerald-400/60",text: "text-emerald-200",   ring: "ring-emerald-400/40" },
  compare: { cell: "bg-fuchsia-500/15 border-fuchsia-400/60",text: "text-fuchsia-200",   ring: "ring-fuchsia-400/40" },
  result:  { cell: "bg-emerald-500/25 border-emerald-300/80",text: "text-emerald-100",   ring: "ring-emerald-300/50" },
  removed: { cell: "bg-red-500/10 border-red-500/30",        text: "text-red-300/60 line-through", ring: "ring-red-500/20" },
};

const CURSOR_PALETTE: Record<NonNullable<ArrayCursor["color"]>, string> = {
  sky:     "bg-sky-500/20 border-sky-400/60 text-sky-200",
  emerald: "bg-emerald-500/20 border-emerald-400/60 text-emerald-200",
  fuchsia: "bg-fuchsia-500/20 border-fuchsia-400/60 text-fuchsia-200",
  amber:   "bg-amber-500/20 border-amber-400/60 text-amber-200",
  red:     "bg-red-500/20 border-red-400/60 text-red-200",
  slate:   "bg-slate-700/40 border-slate-500/60 text-slate-200",
};

function cellStyle(status: DataStatus | undefined) {
  return STATUS_STYLES[status ?? "filled"];
}

function ArrayView({ label, cells, cursors, note }: { label: string; cells: ArrayCell[]; cursors?: ArrayCursor[]; note?: string }) {
  const safeCells = cells ?? [];

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-950/60 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="flex items-baseline justify-between px-4 py-2 border-b border-slate-800/60 bg-slate-900/40">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</span>
        {note ? <span className="text-[10px] font-mono text-slate-500">{note}</span> : null}
      </div>

      <div className="p-4 overflow-x-auto">
        <div className="inline-flex flex-col gap-1">
          {/* keys row */}
          <div className="flex gap-1">
            {safeCells.map((c, i) => (
              <div
                key={`k-${i}`}
                className="min-w-[44px] h-6 rounded-md border border-slate-800/60 bg-slate-900/40 flex items-center justify-center font-mono text-[10px] font-bold text-slate-500"
              >
                {c.key}
              </div>
            ))}
          </div>

          {/* values row */}
          <div className="flex gap-1">
            <AnimatePresence initial={false}>
              {safeCells.map((c, i) => {
                const styles = cellStyle(c.status);
                const isEmpty = c.value == null || c.value === "" || c.status === "empty";
                return (
                  <motion.div
                    key={`v-${c.key}-${i}`}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 300, damping: 24 }}
                    className={cn(
                      "min-w-[44px] h-12 rounded-md border flex items-center justify-center font-mono text-base font-bold ring-1",
                      styles.cell,
                      styles.text,
                      styles.ring,
                      (c.status === "active" || c.status === "compare") && "shadow-[0_0_12px_currentColor]"
                    )}
                  >
                    {isEmpty ? <span className="opacity-40">·</span> : <span>{c.value}</span>}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* cursors row */}
          {cursors && cursors.length > 0 && (
            <div className="relative h-8 mt-1">
              {cursors.map((cur, i) => {
                const idx = safeCells.findIndex((c) => String(c.key) === String(cur.key));
                if (idx < 0) return null;
                const palette = CURSOR_PALETTE[cur.color ?? "fuchsia"];
                return (
                  <motion.div
                    key={`cur-${i}`}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    className="absolute top-0 flex flex-col items-center"
                    style={{ left: `${idx * 48}px`, width: "44px" }}
                  >
                    <div className="text-amber-300 text-xs leading-none">▲</div>
                    <div className={cn("rounded-full px-2 py-0.5 border text-[10px] font-mono font-bold whitespace-nowrap", palette)}>
                      {cur.label}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VarsView({ label, rows, kind, note }: { label: string; rows: VarRow[]; kind: "vars" | "object"; note?: string }) {
  const safeRows = rows ?? [];
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-950/60 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="flex items-baseline justify-between px-4 py-2 border-b border-slate-800/60 bg-slate-900/40">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</span>
        {note ? <span className="text-[10px] font-mono text-slate-500">{note}</span> : null}
      </div>
      <div className="p-3 space-y-1.5">
        <AnimatePresence initial={false}>
          {safeRows.map((row, i) => {
            const styles = cellStyle(row.status);
            return (
              <motion.div
                key={`${row.name}-${i}`}
                layout
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ring-1",
                  styles.cell,
                  styles.ring
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400">{row.name}</span>
                  <span className="text-slate-600 text-xs">{kind === "object" ? ":" : "="}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("font-mono text-sm font-bold", styles.text)}>{row.value}</span>
                  {row.note && <span className="text-[10px] text-slate-500 italic">{row.note}</span>}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ListView({ label, items, kind, note }: { label: string; items: ListItem[]; kind: "stack" | "queue"; note?: string }) {
  const safeItems = items ?? [];
  // Stack visualizes top-down (last item on top); queue visualizes left→right.
  if (kind === "stack") {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-950/60 backdrop-blur-sm shadow-lg overflow-hidden">
        <div className="flex items-baseline justify-between px-4 py-2 border-b border-slate-800/60 bg-slate-900/40">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label} <span className="text-slate-600">(stack)</span></span>
          {note ? <span className="text-[10px] font-mono text-slate-500">{note}</span> : null}
        </div>
        <div className="p-4 flex flex-col-reverse items-center gap-1">
          <AnimatePresence initial={false}>
            {safeItems.map((it, i) => {
              const styles = cellStyle(it.status);
              return (
                <motion.div
                  key={`${it.value}-${i}`}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={cn(
                    "min-w-[120px] h-9 rounded-md border ring-1 flex items-center justify-center font-mono text-sm font-bold",
                    styles.cell, styles.text, styles.ring
                  )}
                >
                  {it.value}
                </motion.div>
              );
            })}
          </AnimatePresence>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mt-1">↑ top</span>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-950/60 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="flex items-baseline justify-between px-4 py-2 border-b border-slate-800/60 bg-slate-900/40">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label} <span className="text-slate-600">(queue)</span></span>
        {note ? <span className="text-[10px] font-mono text-slate-500">{note}</span> : null}
      </div>
      <div className="p-4 flex items-center gap-1 overflow-x-auto">
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mr-2 shrink-0">front →</span>
        <AnimatePresence initial={false}>
          {safeItems.map((it, i) => {
            const styles = cellStyle(it.status);
            return (
              <motion.div
                key={`${it.value}-${i}`}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className={cn(
                  "min-w-[60px] h-9 rounded-md border ring-1 flex items-center justify-center font-mono text-sm font-bold shrink-0",
                  styles.cell, styles.text, styles.ring
                )}
              >
                {it.value}
              </motion.div>
            );
          })}
        </AnimatePresence>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 ml-2 shrink-0">→ back</span>
      </div>
    </div>
  );
}

export default function DataViewRenderer({ views }: { views: DataView[] }) {
  if (!views || views.length === 0) return null;
  return (
    <div className="space-y-4">
      {views.map((v, i) => {
        if (v.kind === "array") {
          return <ArrayView key={i} label={v.label} cells={v.cells} cursors={v.cursors} note={v.note} />;
        }
        if (v.kind === "vars" || v.kind === "object") {
          return <VarsView key={i} label={v.label} rows={v.rows} kind={v.kind} note={v.note} />;
        }
        if (v.kind === "stack" || v.kind === "queue") {
          return <ListView key={i} label={v.label} items={v.items} kind={v.kind} note={v.note} />;
        }
        return null;
      })}
    </div>
  );
}
