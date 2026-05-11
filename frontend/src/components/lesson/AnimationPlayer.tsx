import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Pause, Brain, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnimationFrame } from "@/types";
import CanvasScene from "./CanvasScene";
import DataViewRenderer from "./DataView";
import { Button } from "@/components/ui/button";

interface Props {
  frames: AnimationFrame[];
  activeFrameIndex?: number;
  highlightedNodeIds?: string[];
  onFrameChange?: (idx: number, isCheckpoint: boolean) => void;
}

const BASE_FRAME_DURATION = 2800;
const TICK_MS = 60;

type SpeedOption = 0.25 | 0.5 | 1 | 2;
const SPEED_OPTIONS: SpeedOption[] = [0.25, 0.5, 1, 2];

export default function AnimationPlayer({ frames, activeFrameIndex, highlightedNodeIds = [], onFrameChange }: Props) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<"forward" | "backward">("forward");
  const [autoPlay, setAutoPlay] = useState(() => {
    if (typeof window === "undefined") return false;
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const [frameProgress, setFrameProgress] = useState(0); // 0–100
  const [speed, setSpeed] = useState<SpeedOption>(1);
  const [checkpointCleared, setCheckpointCleared] = useState<Record<number, boolean>>({});

  const frameDuration = BASE_FRAME_DURATION / speed;

  const frame = frames[idx];
  const total = frames.length;

  if (total === 0) return null;

  const isCheckpoint = !!frame?.is_checkpoint && !checkpointCleared[idx];

  // Sync with prop from parent. Only react when the *prop* changes; do NOT
  // re-sync when local `idx` advances (that fights local state and freezes
  // the auto-play loop, because the parent value lags one render behind
  // every local advance).
  const lastExternalIdx = useRef<number | undefined>(activeFrameIndex);
  useEffect(() => {
    if (activeFrameIndex === undefined) return;
    if (activeFrameIndex === lastExternalIdx.current) return;
    lastExternalIdx.current = activeFrameIndex;
    if (activeFrameIndex !== idx) {
      setDir(activeFrameIndex > idx ? "forward" : "backward");
      setIdx(activeFrameIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFrameIndex]);

  const go = (next: number) => {
    if (next > idx && isCheckpoint) return; // Block forward if checkpoint not cleared
    setDir(next > idx ? "forward" : "backward");
    setIdx(next);
  };

  useEffect(() => {
    onFrameChange?.(idx, isCheckpoint);
  }, [idx, isCheckpoint, onFrameChange]);

  const prev = () => { if (idx > 0) go(idx - 1); };
  const next = () => { if (idx < total - 1) go(idx + 1); };

  const handleClearCheckpoint = () => {
    setCheckpointCleared((prev) => ({ ...prev, [idx]: true }));
  };

  // Auto-advance interval
  useEffect(() => {
    if (!autoPlay || isCheckpoint) return;
    const t = setInterval(() => {
      setIdx((i) => {
        if (i >= total - 1) { setAutoPlay(false); return i; }
        setDir("forward");
        return i + 1;
      });
    }, frameDuration);
    return () => clearInterval(t);
  }, [autoPlay, total, frameDuration, isCheckpoint]);

  // Progress-within-frame ticker
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    elapsedRef.current = 0;
    setFrameProgress(0);

    if (!autoPlay || isCheckpoint) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }

    tickRef.current = setInterval(() => {
      elapsedRef.current += TICK_MS;
      const pct = Math.min((elapsedRef.current / frameDuration) * 100, 100);
      setFrameProgress(pct);
    }, TICK_MS);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [autoPlay, idx, frameDuration, isCheckpoint]);

  const isForward = dir === "forward";

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/80 backdrop-blur-md overflow-hidden select-none shadow-2xl ring-1 ring-slate-700/30">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-slate-700/50 bg-slate-900/40 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fuchsia-500/10 text-[10px] font-bold text-fuchsia-400 ring-1 ring-fuchsia-500/30">
              {idx + 1}
            </span>
            {isCheckpoint && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
              </span>
            )}
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 block leading-none mb-0.5">
              Logic Stream
            </span>
            <span className="text-xs font-medium text-slate-300">
              Frame {idx + 1} of {total}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Speed selector */}
          <div className="hidden sm:flex items-center gap-1 rounded-lg border border-slate-700/40 bg-slate-950/50 p-1">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[9px] font-bold transition-all",
                  speed === s
                    ? "bg-sky-500/20 text-sky-300 shadow-[0_0_10px_rgba(14,165,233,0.2)]"
                    : "text-slate-600 hover:text-slate-400"
                )}
              >
                {s}x
              </button>
            ))}
          </div>
          {/* Play / Pause */}
          <Button
            variant="ghost"
            size="sm"
            aria-label={autoPlay ? "Pause autoplay" : "Start autoplay"}
            onClick={() => setAutoPlay((v) => !v)}
            disabled={isCheckpoint}
            className={cn(
              "h-8 gap-2 rounded-lg border px-3 text-xs font-bold transition-all uppercase tracking-wider",
              autoPlay
                ? "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20"
                : "border-slate-700/50 bg-slate-800/50 text-slate-400 hover:bg-slate-700/50",
              isCheckpoint && "opacity-20 grayscale pointer-events-none"
            )}
          >
            {autoPlay ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
            {autoPlay ? "Pause" : "Auto"}
          </Button>
        </div>
      </div>

      {/* ── Frame content ── */}
      <div className="relative mesh-gradient">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: isForward ? 20 : -20, filter: "blur(10px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: isForward ? -20 : 20, filter: "blur(10px)" }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="p-5 md:p-6 space-y-5"
          >
            {/* Frame Title & Progress */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {frame?.title}
                </h3>
                <p className="text-sm font-medium text-slate-400 leading-relaxed">
                  {frame?.narration}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              {/* Code State */}
              <div className="group">
                <div className="rounded-xl overflow-hidden border border-slate-700/40 bg-slate-950/40 glass-panel shadow-lg transition-all duration-300 group-hover:border-sky-500/30">
                  <div className="flex items-center justify-between bg-slate-900/60 px-4 py-2 border-b border-slate-700/40">
                    <div className="flex gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-slate-700" />
                      <div className="h-2 w-2 rounded-full bg-slate-700" />
                      <div className="h-2 w-2 rounded-full bg-slate-700" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Live State</span>
                  </div>
                  <pre className="px-5 py-4 font-mono text-xs leading-relaxed text-sky-300 overflow-x-auto selection:bg-sky-500/30">
                    {frame?.code_state}
                  </pre>
                </div>
              </div>

              {/* Data Views (preferred) or Canvas Scene (fallback) */}
              <div>
                {frame?.data_views && frame.data_views.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="relative"
                  >
                    <DataViewRenderer views={frame.data_views} />
                  </motion.div>
                ) : frame?.canvas_scene && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="relative"
                  >
                    <CanvasScene
                      scene={frame.canvas_scene}
                      highlightedNodeIds={highlightedNodeIds}
                    />
                    
                    {/* Effects Overlay */}
                    {frame.effects && frame.effects.length > 0 && (
                      <div className="absolute top-4 right-4 flex flex-col gap-2">
                        {frame.effects.map((e, i) => (
                          e.why && (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 px-3 py-1.5 rounded-lg text-[10px] font-medium text-slate-300 shadow-xl"
                            >
                              <span className="text-sky-400 font-bold mr-2">{e.target}:</span>
                              {e.why}
                            </motion.div>
                          )
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Checkpoint UI */}
            <AnimatePresence>
              {isCheckpoint && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
                  className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5 discovery-gate p-8 shadow-[0_0_50px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-4 max-w-xl">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30 shadow-inner">
                          <Brain className="h-6 w-6" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500 block mb-0.5">
                            Discovery Gate
                          </span>
                          <h4 className="text-xl font-bold text-white tracking-tight">Active Prediction Required</h4>
                        </div>
                      </div>
                      
                      <p className="text-lg font-medium text-slate-200 leading-relaxed">
                        {frame?.checkpoint_question ?? "Analyze the current state. What do you think happens next in the logic?"}
                      </p>
                      
                      <div className="flex items-center gap-2 text-amber-400/80">
                        <HelpCircle className="h-4 w-4" />
                        <p className="text-xs font-bold uppercase tracking-widest">Tip: Hypothesize in the chat to the right</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 shrink-0">
                       <Button 
                        size="lg" 
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-10 h-14 rounded-xl shadow-lg shadow-amber-500/20 group transition-all"
                        onClick={handleClearCheckpoint}
                      >
                        I've made my prediction
                        <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Decorative pulse */}
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-500/10 blur-3xl rounded-full animate-pulse" />
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Auto-play progress bar — between frame content and controls */}
      {autoPlay && idx < total - 1 && !isCheckpoint && (
        <div className="h-0.5 bg-slate-800 shrink-0">
          <div
            className="h-full bg-gradient-to-r from-fuchsia-500 via-sky-500 to-emerald-500"
            style={{ width: `${frameProgress}%`, transition: "none" }}
          />
        </div>
      )}

      {/* ── Controls ── */}
      <div className="border-t border-slate-700/50 px-5 py-4 flex items-center justify-between bg-slate-900/60 backdrop-blur-sm">
        <Button
          variant="outline"
          size="sm"
          onClick={prev}
          disabled={idx === 0}
          className="h-9 gap-1.5 border-slate-700/60 bg-slate-800/40 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-30 uppercase tracking-tighter font-bold text-[10px]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {frames.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              disabled={i > idx && isCheckpoint}
              aria-label={`Frame ${i + 1}${i === idx ? ", current" : ""}`}
              aria-disabled={i > idx && isCheckpoint}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === idx
                  ? "w-8 bg-fuchsia-500 shadow-[0_0_12px_rgba(168,85,247,0.6)]"
                  : i < idx
                    ? "w-2 bg-slate-500"
                    : "w-2 bg-slate-800 hover:bg-slate-700",
                i > idx && isCheckpoint && "opacity-30 cursor-not-allowed"
              )}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={next}
          disabled={idx === total - 1 || isCheckpoint}
          className={cn(
            "h-9 gap-1.5 border-slate-700/60 bg-slate-800/40 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-30 uppercase tracking-tighter font-bold text-[10px]",
            isCheckpoint && "border-amber-500/50 text-amber-500/50"
          )}
        >
          Proceed
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
