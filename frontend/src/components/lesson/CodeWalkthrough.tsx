import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface WalkthroughItem {
  code: string;
  plain_english: string;
  why: string;
}

interface Props {
  items: WalkthroughItem[];
}

const BASE_DURATION = 2800;
type SpeedOption = 0.25 | 0.5 | 1 | 2;
const SPEED_OPTIONS: SpeedOption[] = [0.25, 0.5, 1, 2];

export default function CodeWalkthrough({ items }: Props) {
  const [current, setCurrent] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [speed, setSpeed] = useState<SpeedOption>(1);
  const activeRef = useRef<HTMLDivElement>(null);

  const stepDuration = BASE_DURATION / speed;

  // Auto-play: advance one entry per stepDuration, stop at end
  useEffect(() => {
    if (!autoPlay) return;
    const t = setInterval(() => {
      setCurrent(i => {
        if (i >= items.length - 1) { setAutoPlay(false); return i; }
        return i + 1;
      });
    }, stepDuration);
    return () => clearInterval(t);
  }, [autoPlay, items.length, stepDuration]);

  // Keep the active code row scrolled into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [current]);

  const item = items[current];

  return (
    <div className="rounded-2xl border border-slate-700/60 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Line by line
          </span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            {current + 1} / {items.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Speed selector */}
          <div className="flex items-center gap-0.5 rounded-full border border-slate-700/60 bg-slate-900 p-0.5">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums transition-all",
                  speed === s
                    ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30"
                    : "text-slate-600 hover:text-slate-400"
                )}
              >
                {s}x
              </button>
            ))}
          </div>
          {/* Step backward */}
          <button
            onClick={() => { setCurrent(i => Math.max(0, i - 1)); setAutoPlay(false); }}
            disabled={current === 0}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700/60 text-slate-500 disabled:opacity-30 hover:enabled:border-slate-500 hover:enabled:text-slate-300 transition-all"
            title="Step backward"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          {/* Play / Pause */}
          <button
            onClick={() => setAutoPlay(v => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
              autoPlay
                ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                : "border-slate-700/60 text-slate-600 hover:text-slate-400"
            )}
          >
            {autoPlay ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {autoPlay ? "Pause" : "Play"}
          </button>
          {/* Step forward */}
          <button
            onClick={() => { setCurrent(i => Math.min(items.length - 1, i + 1)); setAutoPlay(false); }}
            disabled={current === items.length - 1}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700/60 text-slate-500 disabled:opacity-30 hover:enabled:border-slate-500 hover:enabled:text-slate-300 transition-all"
            title="Step forward"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* ── Split view ── */}
      <div className="flex" style={{ height: 320 }}>

        {/* Left: code list — click any row to jump to it */}
        <div className="w-[52%] shrink-0 border-r border-slate-700/50 overflow-y-auto bg-slate-950 scrollbar-none">
          {items.map((entry, i) => (
            <div
              key={i}
              ref={i === current ? activeRef : undefined}
              onClick={() => { setCurrent(i); setAutoPlay(false); }}
              className={cn(
                "group cursor-pointer border-l-2 px-4 py-3 transition-all duration-200",
                i === current
                  ? "border-l-sky-400 bg-sky-500/[0.07]"
                  : "border-l-transparent hover:border-l-slate-700 hover:bg-slate-800/30"
              )}
            >
              <pre
                className={cn(
                  "font-mono text-sm leading-6 whitespace-pre-wrap break-words transition-colors duration-200",
                  i === current
                    ? "text-sky-300"
                    : "text-slate-600 group-hover:text-slate-500"
                )}
              >
                {entry.code}
              </pre>
            </div>
          ))}
        </div>

        {/* Right: animated description */}
        <div className="flex-1 overflow-y-auto bg-slate-900/30 p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="space-y-4"
            >
              {/* What it does */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">
                  What it does
                </p>
                <p className="text-sm leading-relaxed text-slate-200">
                  {item.plain_english}
                </p>
              </div>

              {/* Why */}
              {item.why && (
                <div className="flex gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-3">
                  <Zap className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 mb-1.5">
                      Why
                    </p>
                    <p className="text-sm leading-relaxed text-slate-400">
                      {item.why}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="h-0.5 bg-slate-800">
        <motion.div
          className="h-full bg-gradient-to-r from-sky-500 to-fuchsia-500"
          animate={{ width: `${((current + 1) / items.length) * 100}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 40 }}
        />
      </div>
    </div>
  );
}
