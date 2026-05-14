import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DataView, DataStatus, ArrayCell, ArrayCursor, VarRow, ListItem } from "@/types";
import { cn } from "@/lib/utils";
import { BASE_FRAME_DURATION } from "./AnimationPlayer";

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

const ACTIVE_GLOW: Partial<Record<DataStatus, string[]>> = {
  active:  ["0 0 0px rgba(251,191,36,0.2)", "0 0 14px rgba(251,191,36,0.55)", "0 0 7px rgba(251,191,36,0.25)"],
  compare: ["0 0 0px rgba(232,121,249,0.2)", "0 0 14px rgba(232,121,249,0.55)", "0 0 7px rgba(232,121,249,0.25)"],
};

function cellStyle(status: DataStatus | undefined) {
  return STATUS_STYLES[status ?? "filled"];
}

function ArrayView({ label, cells, cursors, note }: { label: string; cells: ArrayCell[]; cursors?: ArrayCursor[]; note?: string }) {
  const safeCells = cells ?? [];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, scale: 0.9, y: 4 },
    show: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 24,
      }
    },
  };

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-950/60 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="flex items-baseline justify-between px-4 py-2 border-b border-slate-800/60 bg-slate-900/40">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</span>
        {note ? <span className="text-[10px] font-mono text-slate-500">{note}</span> : null}
      </div>

      <div className="p-4 overflow-x-auto">
        <motion.div 
          className="inline-flex gap-1"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {safeCells.map((c, i) => {
            const styles = cellStyle(c.status);
            const isEmpty = c.value == null || c.value === "" || c.status === "empty";
            const glowKf = ACTIVE_GLOW[c.status ?? "filled"];
            const isScanning = c.status === "active" || c.status === "compare";
            const cellCursors = (cursors ?? []).filter((cur) => String(cur.key) === String(c.key));

            return (
              <div key={`cell-group-${i}`} className="flex flex-col gap-1 min-w-[44px]">
                {/* Key */}
                <motion.div
                  variants={item}
                  className="h-6 rounded-md border border-slate-800/60 bg-slate-900/40 flex items-center justify-center font-mono text-[10px] font-bold text-slate-500"
                >
                  {c.key}
                </motion.div>

                {/* Value */}
                <motion.div
                  layout
                  variants={item}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    ...(glowKf ? { boxShadow: glowKf } : {}),
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 24,
                    ...(glowKf ? { boxShadow: { repeat: Infinity, duration: 1.2, ease: "easeInOut" } } : {}),
                  }}
                  className={cn(
                    "relative h-12 rounded-md border flex items-center justify-center font-mono text-base font-bold ring-1 overflow-hidden px-3",
                    styles.cell,
                    styles.text,
                    styles.ring
                  )}
                >
                  {isScanning && (
                    <motion.div
                      className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-white/10 to-transparent h-1/2 w-full"
                      animate={{ top: ["-50%", "100%"] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">
                    {isEmpty ? <span className="opacity-40">·</span> : <span>{c.value}</span>}
                  </span>
                </motion.div>
                
                {/* Cursors Area */}
                <div className="relative h-8 mt-1 flex justify-center">
                  <AnimatePresence>
                    {cellCursors.map((cur) => (
                      <motion.div
                        key={`cursor-${cur.label}`}
                        layoutId={`cursor-${cur.label}`}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        className="absolute top-0 flex flex-col items-center"
                      >
                        <div className="text-amber-300 text-xs leading-none">▲</div>
                        <div className={cn(
                          "rounded-full px-2 py-0.5 border text-[10px] font-mono font-bold whitespace-nowrap shadow-lg",
                          CURSOR_PALETTE[cur.color ?? "fuchsia"]
                        )}>
                          {cur.label}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

function VarRowItem({ row, kind, variants, speed = 1 }: { row: VarRow; kind: "vars" | "object"; variants?: any; speed?: number }) {
  const prevValueRef = useRef(row.value);
  const [flashing, setFlashing] = useState(false);
  const styles = cellStyle(row.status);
  const isScanning = row.status === "active" || row.status === "compare";

  useEffect(() => {
    if (prevValueRef.current !== row.value) {
      prevValueRef.current = row.value;
      setFlashing(true);
      const flashDuration = (BASE_FRAME_DURATION / speed) * 0.22;
      const t = setTimeout(() => setFlashing(false), flashDuration);
      return () => clearTimeout(t);
    }
  }, [row.value, speed]);

  return (
    <motion.div
      layout
      variants={variants}
      exit={{ opacity: 0, x: 6 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={cn(
        "relative flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ring-1 overflow-hidden",
        styles.cell,
        styles.ring
      )}
    >
      {isScanning && (
        <motion.div
          className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/5 to-transparent w-1/2 h-full"
          animate={{ left: ["-50%", "100%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      )}
      <div className="relative z-10 flex items-center gap-2">
        <span className="font-mono text-xs text-slate-400">{row.name}</span>
        <span className="text-slate-600 text-xs">{kind === "object" ? ":" : "="}</span>
      </div>
      <div className="relative z-10 flex items-center gap-3">
        <span className={cn(
          "font-mono text-sm font-bold transition-colors duration-300",
          flashing ? "text-amber-300" : styles.text
        )}>
          {row.value}
        </span>
        {row.note && <span className="text-[10px] text-slate-500 italic">{row.note}</span>}
      </div>
    </motion.div>
  );
}

function VarsView({ label, rows, kind, note, speed = 1 }: { label: string; rows: VarRow[]; kind: "vars" | "object"; note?: string; speed?: number }) {
  const safeRows = rows ?? [];
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };
  const item = {
    hidden: { opacity: 0, x: -10 },
    show: { opacity: 1, x: 0 }
  };

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-950/60 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="flex items-baseline justify-between px-4 py-2 border-b border-slate-800/60 bg-slate-900/40">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</span>
        {note ? <span className="text-[10px] font-mono text-slate-500">{note}</span> : null}
      </div>
      <motion.div 
        className="p-3 space-y-1.5"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <AnimatePresence initial={false}>
          {safeRows.map((row, i) => (
            <VarRowItem key={`${row.name}-${i}`} row={row} kind={kind} variants={item} speed={speed} />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function ListView({ label, items, kind, note }: { label: string; items: ListItem[]; kind: "stack" | "queue"; note?: string }) {
  const safeItems = items ?? [];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06 }
    }
  };

  const itemVariants = {
    hidden: (kind === "stack" ? { opacity: 0, y: -24, scale: 0.88 } : { opacity: 0, x: 32, scale: 0.85 }),
    show: { 
      opacity: 1, 
      y: 0, 
      x: 0, 
      scale: 1,
      transition: { type: "spring", stiffness: 320, damping: 24 }
    }
  };

  if (kind === "stack") {
    const reversed = [...safeItems].reverse();
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-950/60 backdrop-blur-sm shadow-lg overflow-hidden">
        <div className="flex items-baseline justify-between px-4 py-2 border-b border-slate-800/60 bg-slate-900/40">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            {label} <span className="text-slate-600">(stack)</span>
          </span>
          {note ? <span className="text-[10px] font-mono text-slate-500">{note}</span> : null}
        </div>
        <motion.div 
          className="p-4 flex flex-col items-center gap-1.5"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">↑ top</span>
          <AnimatePresence initial={false}>
            {reversed.map((it, depth) => {
              const styles = cellStyle(it.status);
              const isTos = depth === 0;
              const opacity = Math.max(0.45, 1 - depth * 0.18);
              const isScanning = it.status === "active" || it.status === "compare";
              
              return (
                <motion.div
                  key={it.value}
                  layout
                  variants={itemVariants}
                  animate={{ opacity, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.88 }}
                  className={cn(
                    "relative min-w-[120px] h-9 rounded-md border ring-1 flex items-center justify-center font-mono text-sm font-bold overflow-hidden",
                    styles.cell, styles.text, styles.ring,
                    isTos && "shadow-[0_0_8px_rgba(56,189,248,0.25)]"
                  )}
                >
                  {isScanning && (
                    <motion.div
                      className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-white/10 to-transparent h-1/2 w-full"
                      animate={{ top: ["-50%", "100%"] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                  )}
                  {isTos && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 whitespace-nowrap">
                      TOS
                    </span>
                  )}
                  <span className="relative z-10">{it.value}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {safeItems.length === 0 && (
            <span className="text-[10px] text-slate-700 italic py-2">empty stack</span>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-950/60 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="flex items-baseline justify-between px-4 py-2 border-b border-slate-800/60 bg-slate-900/40">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          {label} <span className="text-slate-600">(queue)</span>
        </span>
        {note ? <span className="text-[10px] font-mono text-slate-500">{note}</span> : null}
      </div>
      <div className="flex items-center px-4 py-3 gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 shrink-0">FRONT</span>
        <motion.div 
          className="flex items-center gap-1 overflow-x-auto flex-1"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {safeItems.map((it) => {
              const styles = cellStyle(it.status);
              const isScanning = it.status === "active" || it.status === "compare";
              
              return (
                <motion.div
                  key={it.value}
                  layout
                  variants={itemVariants}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -28, scale: 0.9 }}
                  className={cn(
                    "relative min-w-[60px] h-9 rounded-md border ring-1 flex items-center justify-center font-mono text-sm font-bold shrink-0 overflow-hidden",
                    styles.cell, styles.text, styles.ring
                  )}
                >
                  {isScanning && (
                    <motion.div
                      className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-white/10 to-transparent h-1/2 w-full"
                      animate={{ top: ["-50%", "100%"] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                  )}
                  <span className="relative z-10">{it.value}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {safeItems.length === 0 && (
            <span className="text-[10px] text-slate-700 italic">empty queue</span>
          )}
        </motion.div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-fuchsia-600 shrink-0">BACK</span>
      </div>
    </div>
  );
}

function BranchView({
  label,
  condition,
  true_path,
  false_path,
  active_path,
  note,
}: {
  label: string;
  condition: string;
  true_path?: string[];
  false_path?: string[];
  active_path?: "true" | "false" | null;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-950/60 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="flex items-baseline justify-between px-4 py-2 border-b border-slate-800/60 bg-slate-900/40">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          {label} <span className="text-slate-600">(branch)</span>
        </span>
        {note ? <span className="text-[10px] font-mono text-slate-500">{note}</span> : null}
      </div>
      <div className="p-4 flex flex-col items-center gap-4">
        {/* Diamond condition node */}
        <div className="relative flex items-center justify-center w-36 h-16">
          <div
            className="absolute inset-2 rounded"
            style={{
              background: "rgba(56,189,248,0.08)",
              border: "1px solid rgba(56,189,248,0.35)",
              transform: "rotate(45deg)",
            }}
          />
          <span className="relative z-10 text-xs font-mono text-sky-300 font-bold text-center px-3 leading-tight">
            {condition}
          </span>
        </div>

        {/* Branches */}
        <div className="flex w-full gap-2">
          <motion.div
            animate={{ opacity: active_path === "false" ? 0.35 : active_path === "true" ? 1 : 0.7 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "flex-1 rounded-lg border p-3",
              active_path === "true"
                ? "border-sky-400/60 bg-sky-500/10 shadow-[0_0_12px_rgba(56,189,248,0.18)]"
                : "border-slate-700/40 bg-slate-900/30"
            )}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-sky-500 mb-2">TRUE</div>
            <div className="space-y-1">
              {(true_path ?? []).map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="text-xs font-mono text-sky-200/80"
                >
                  {step}
                </motion.div>
              ))}
              {!(true_path ?? []).length && (
                <div className="text-[10px] text-slate-600 italic">pass</div>
              )}
            </div>
          </motion.div>

          <motion.div
            animate={{ opacity: active_path === "true" ? 0.35 : active_path === "false" ? 1 : 0.7 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "flex-1 rounded-lg border p-3",
              active_path === "false"
                ? "border-fuchsia-400/60 bg-fuchsia-500/10 shadow-[0_0_12px_rgba(232,121,249,0.18)]"
                : "border-slate-700/40 bg-slate-900/30"
            )}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-fuchsia-500 mb-2">FALSE</div>
            <div className="space-y-1">
              {(false_path ?? []).map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="text-xs font-mono text-fuchsia-200/80"
                >
                  {step}
                </motion.div>
              ))}
              {!(false_path ?? []).length && (
                <div className="text-[10px] text-slate-600 italic">pass</div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function DataViewRenderer({ views, speed = 1 }: { views: DataView[]; speed?: number }) {
  if (!views || views.length === 0) return null;
  return (
    <div className="space-y-4">
      {views.map((v, i) => {
        if (v.kind === "array") {
          return <ArrayView key={i} label={v.label} cells={v.cells} cursors={v.cursors} note={v.note} />;
        }
        if (v.kind === "vars" || v.kind === "object") {
          return <VarsView key={i} label={v.label} rows={v.rows} kind={v.kind} note={v.note} speed={speed} />;
        }
        if (v.kind === "stack" || v.kind === "queue") {
          return <ListView key={i} label={v.label} items={v.items} kind={v.kind} note={v.note} />;
        }
        if (v.kind === "branch") {
          return (
            <BranchView
              key={i}
              label={v.label}
              condition={v.condition}
              true_path={v.true_path}
              false_path={v.false_path}
              active_path={v.active_path}
              note={v.note}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
