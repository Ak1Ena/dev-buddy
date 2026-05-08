import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnimationFrame } from "@/types";
import CanvasScene from "./CanvasScene";
import EffectLayer from "./EffectLayer";

interface Props {
  frames: AnimationFrame[];
}

const FRAME_DURATION = 2800;
const TICK_MS = 60;

export default function AnimationPlayer({ frames }: Props) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<"forward" | "backward">("forward");
  const [autoPlay, setAutoPlay] = useState(false);
  const [frameProgress, setFrameProgress] = useState(0); // 0–100

  const frame = frames[idx];
  const total = frames.length;

  const go = (next: number) => {
    setDir(next > idx ? "forward" : "backward");
    setIdx(next);
  };
  const prev = () => { if (idx > 0) go(idx - 1); };
  const next = () => { if (idx < total - 1) go(idx + 1); };

  // Auto-advance interval
  useEffect(() => {
    if (!autoPlay) return;
    const t = setInterval(() => {
      setIdx((i) => {
        if (i >= total - 1) { setAutoPlay(false); return i; }
        setDir("forward");
        return i + 1;
      });
    }, FRAME_DURATION);
    return () => clearInterval(t);
  }, [autoPlay, total]);

  // Progress-within-frame ticker
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    // Reset whenever frame changes or autoPlay turns off
    elapsedRef.current = 0;
    setFrameProgress(0);

    if (!autoPlay) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }

    tickRef.current = setInterval(() => {
      elapsedRef.current += TICK_MS;
      const pct = Math.min((elapsedRef.current / FRAME_DURATION) * 100, 100);
      setFrameProgress(pct);
    }, TICK_MS);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [autoPlay, idx]);

  const secondsLeft = Math.max(
    0,
    Math.ceil((FRAME_DURATION - elapsedRef.current) / 1000)
  );

  const isForward = dir === "forward";

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
            initial={{ opacity: 0, x: isForward ? 40 : -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isForward ? -40 : 40 }}
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

            {/* Canvas scene (new) or text visual fallback (legacy) */}
            {frame.canvas_scene ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.08, duration: 0.3 }}
              >
                <CanvasScene scene={frame.canvas_scene} />
              </motion.div>
            ) : frame.visual ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="flex gap-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 px-4 py-3.5"
              >
                <span className="text-2xl shrink-0 leading-none">
                  {frame.visual.match(/^\S+/)?.[0] ?? "✨"}
                </span>
                <p className="text-sm leading-relaxed text-fuchsia-200">
                  {frame.visual.replace(/^\S+\s*/, "")}
                </p>
              </motion.div>
            ) : null}

            {/* Effect layer.
                When the canvas is showing edges with particles, we don't
                duplicate the same animation below. Instead, render a compact
                text list of "why this changed" per pulse effect — keeping the
                explanations without the visual clutter.
                When there's no canvas, fall back to the full EffectLayer. */}
            {frame.effects && frame.effects.length > 0 && (
              frame.canvas_scene ? (
                (() => {
                  const annotated = frame.effects.filter(
                    (e) => e.why || (e.label && (e.from_value || e.to_value || e.from || e.to))
                  );
                  if (annotated.length === 0) return null;
                  return (
                    <motion.ul
                      className="space-y-1.5 pl-0.5"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.14, duration: 0.25 }}
                    >
                      {annotated.map((e, i) => {
                        const fromVal = e.from_value ?? e.from;
                        const toVal = e.to_value ?? e.to;
                        return (
                          <li
                            key={i}
                            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs leading-relaxed"
                          >
                            {e.target && (
                              <span className="font-mono font-semibold text-fuchsia-300">
                                {e.target}
                              </span>
                            )}
                            {fromVal != null && toVal != null && (
                              <span className="font-mono text-slate-500">
                                <span className="line-through decoration-slate-600">{fromVal}</span>
                                <span className="mx-1.5 text-slate-600">→</span>
                                <span className="text-slate-300">{toVal}</span>
                              </span>
                            )}
                            <span className="text-slate-400">{e.why ?? e.label}</span>
                          </li>
                        );
                      })}
                    </motion.ul>
                  );
                })()
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.14, duration: 0.25 }}
                >
                  <EffectLayer effects={frame.effects} />
                </motion.div>
              )
            )}

            {/* Narration */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.3 }}
              className="text-base font-medium leading-relaxed text-slate-200"
            >
              {frame.narration}
            </motion.div>

            {/* Per-frame countdown progress bar (auto-play only) */}
            {autoPlay && idx < total - 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="pt-1"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-600 tabular-nums">
                    next in {secondsLeft}s
                  </span>
                </div>
                <div className="h-0.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-sky-500 transition-none"
                    style={{ width: `${frameProgress}%` }}
                  />
                </div>
              </motion.div>
            )}
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
