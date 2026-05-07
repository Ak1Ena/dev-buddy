import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AnimationFrame {
  frame: number;
  title: string;
  code_state: string;
  visual: string;
  narration: string;
}

interface Props {
  frames: AnimationFrame[];
}

const SLIDE: Record<string, object> = {
  enterForward:  { initial: { opacity: 0, x: 40  }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -40  } },
  enterBackward: { initial: { opacity: 0, x: -40 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x:  40  } },
};

export default function AnimationPlayer({ frames }: Props) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<"forward" | "backward">("forward");
  const [autoPlay, setAutoPlay] = useState(false);

  const frame = frames[idx];
  const total = frames.length;

  const go = (next: number) => {
    setDir(next > idx ? "forward" : "backward");
    setIdx(next);
  };
  const prev = () => { if (idx > 0) go(idx - 1); };
  const next = () => { if (idx < total - 1) go(idx + 1); };

  // Auto-play ticker
  useState(() => {
    if (!autoPlay) return;
    const t = setInterval(() => {
      setIdx((i) => {
        if (i >= total - 1) { setAutoPlay(false); return i; }
        setDir("forward");
        return i + 1;
      });
    }, 2800);
    return () => clearInterval(t);
  });

  const { initial, animate, exit } = SLIDE[dir === "forward" ? "enterForward" : "enterBackward"] as {
    initial: object; animate: object; exit: object;
  };

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950 overflow-hidden select-none">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-slate-700/50 bg-slate-900/80 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fuchsia-500/20 text-xs font-bold text-fuchsia-300 ring-1 ring-fuchsia-500/30">
            {idx + 1}
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Animation
          </span>
        </div>
        <button
          onClick={() => setAutoPlay((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
            autoPlay
              ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300"
              : "border-slate-700/60 text-slate-600 hover:text-slate-400"
          )}
        >
          {autoPlay ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {autoPlay ? "Pause" : "Auto-play"}
        </button>
      </div>

      {/* ── Frame content ── */}
      <div className="relative overflow-hidden" style={{ minHeight: "360px" }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={idx}
            initial={initial}
            animate={animate}
            exit={exit}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="p-6 space-y-5"
          >
            {/* Frame title */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-600 mb-0.5">
                Frame {frame.frame}
              </p>
              <h3 className="text-base font-semibold text-white">{frame.title}</h3>
            </div>

            {/* Code state */}
            <div className="rounded-xl overflow-hidden border border-slate-700/60">
              <div className="flex items-center gap-1.5 bg-slate-900 px-4 py-2 border-b border-slate-700/60">
                <div className="h-2 w-2 rounded-full bg-red-500/50" />
                <div className="h-2 w-2 rounded-full bg-yellow-500/50" />
                <div className="h-2 w-2 rounded-full bg-emerald-500/50" />
                <span className="ml-2 text-xs text-slate-600">state</span>
              </div>
              <pre className="bg-slate-950 px-5 py-3.5 font-mono text-sm leading-6 text-sky-300 overflow-x-auto">
                {frame.code_state}
              </pre>
            </div>

            {/* Visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="flex gap-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 px-4 py-3.5"
            >
              <span className="text-2xl shrink-0 leading-none">{frame.visual.match(/^\S+/)?.[0] ?? "✨"}</span>
              <p className="text-sm leading-relaxed text-fuchsia-200">
                {frame.visual.replace(/^\S+\s*/, "")}
              </p>
            </motion.div>

            {/* Narration */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.3 }}
              className="text-base font-medium leading-relaxed text-slate-200"
            >
              {frame.narration}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Controls ── */}
      <div className="border-t border-slate-700/50 px-5 py-3 flex items-center justify-between bg-slate-900/60">
        <button
          onClick={prev}
          disabled={idx === 0}
          className="flex items-center gap-1 rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs font-medium text-slate-500 disabled:opacity-30 hover:enabled:border-slate-500 hover:enabled:text-slate-300 transition-all"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>

        {/* Dot nav */}
        <div className="flex items-center gap-1.5">
          {frames.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className={cn(
                "rounded-full transition-all duration-200",
                i === idx
                  ? "h-2 w-5 bg-fuchsia-500"
                  : "h-2 w-2 bg-slate-700 hover:bg-slate-500"
              )}
            />
          ))}
        </div>

        <button
          onClick={next}
          disabled={idx === total - 1}
          className="flex items-center gap-1 rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs font-medium text-slate-500 disabled:opacity-30 hover:enabled:border-slate-500 hover:enabled:text-slate-300 transition-all"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-slate-800">
        <motion.div
          className="h-full bg-gradient-to-r from-fuchsia-500 to-sky-500"
          animate={{ width: `${((idx + 1) / total) * 100}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 40 }}
        />
      </div>
    </div>
  );
}
