import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Pause, Brain, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnimationFrame, CanvasNode } from "@/types";
import { SceneJSON } from "../../engine/types";
import RuntimeManager from "../../engine/r3f/core/RuntimeManager";
import DataViewRenderer from "./DataView";
import EffectLayer from "./EffectLayer";
import ExecutionStateView from "./ExecutionStateView";
import { Button } from "@/components/ui/button";

interface Props {
  frames: AnimationFrame[];
  activeFrameIndex?: number;
  highlightedNodeIds?: string[];
  onFrameChange?: (idx: number, isCheckpoint: boolean) => void;
}

export const BASE_FRAME_DURATION = 2800;
const TICK_MS = 60;

type SpeedOption = 0.25 | 0.5 | 1 | 2;
const SPEED_OPTIONS: SpeedOption[] = [0.25, 0.5, 1, 2];

export default function AnimationPlayer({ frames, activeFrameIndex, highlightedNodeIds = [], onFrameChange }: Props) {
  const [idx, setIdx] = useState(0);
  const [subIdx, setSubIdx] = useState(0);
  const [dir, setDir] = useState<"forward" | "backward">("forward");
  const [autoPlay, setAutoPlay] = useState(() => {
    if (typeof window === "undefined") return false;
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const [frameProgress, setFrameProgress] = useState(0); // 0–100
  const [speed, setSpeed] = useState<SpeedOption>(1);
  const [checkpointCleared, setCheckpointCleared] = useState<Record<number, boolean>>({});

  const frameDuration = BASE_FRAME_DURATION / speed;

  const mainFrame = frames[idx];
  const total = frames.length;

  // Reset state when frames change (e.g. new lesson loaded)
  useEffect(() => {
    setIdx(0);
    setSubIdx(0);
    setDir("forward");
    setAutoPlay(false);
    setFrameProgress(0);
    setCheckpointCleared({});
  }, [frames]);

  if (total === 0) return null;

  const subFrames = mainFrame?.sub_frames ?? [];
  const rawSubFrame = subFrames[subIdx];
  
  // Inherit visual state from main frame if sub-frame is missing it
  const displayFrame = rawSubFrame ? {
    ...rawSubFrame,
    data_views: rawSubFrame.data_views || mainFrame?.data_views,
    canvas_scene: rawSubFrame.canvas_scene || mainFrame?.canvas_scene,
    code_state: rawSubFrame.code_state || mainFrame?.code_state,
    title: rawSubFrame.title || mainFrame?.title,
  } : mainFrame;

  const isCheckpoint = !!mainFrame?.is_checkpoint && !checkpointCleared[idx];

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
      setSubIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFrameIndex]);

  const go = (next: number) => {
    if (next > idx && isCheckpoint) return; // Block forward if checkpoint not cleared
    setDir(next > idx ? "forward" : "backward");
    setIdx(next);
    setSubIdx(0);
  };

  useEffect(() => {
    onFrameChange?.(idx, isCheckpoint);
  }, [idx, isCheckpoint, onFrameChange]);

  const prev = () => {
    if (subIdx > 0) {
      setSubIdx(subIdx - 1);
    } else if (idx > 0) {
      const prevFrame = frames[idx - 1];
      const prevSubFramesCount = prevFrame?.sub_frames?.length ?? 0;
      setDir("backward");
      setIdx(idx - 1);
      setSubIdx(prevSubFramesCount > 0 ? prevSubFramesCount - 1 : 0);
    }
  };

  const next = () => {
    if (subIdx < subFrames.length - 1) {
      setSubIdx(subIdx + 1);
    } else if (idx < total - 1) {
      if (isCheckpoint) return;
      setDir("forward");
      setIdx(idx + 1);
      setSubIdx(0);
    }
  };

  const handleClearCheckpoint = () => {
    setCheckpointCleared((prev) => ({ ...prev, [idx]: true }));
  };

  // Auto-advance interval
  useEffect(() => {
    if (!autoPlay || isCheckpoint) return;
    const t = setInterval(() => {
      if (subIdx < subFrames.length - 1) {
        setSubIdx((s) => s + 1);
      } else {
        setIdx((i) => {
          if (i >= total - 1) { setAutoPlay(false); return i; }
          setDir("forward");
          setSubIdx(0);
          return i + 1;
        });
      }
    }, frameDuration);
    return () => clearInterval(t);
  }, [autoPlay, total, frameDuration, isCheckpoint, subIdx, subFrames.length]);

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
  }, [autoPlay, idx, subIdx, frameDuration, isCheckpoint]);

  const isForward = dir === "forward";

  return (
    <div className="h-full flex flex-col rounded-2xl border border-slate-700/60 bg-slate-950/80 backdrop-blur-md overflow-hidden select-none shadow-2xl ring-1 ring-slate-700/30">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-slate-700/50 bg-slate-900/40 px-5 py-2.5">
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
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 block leading-none mb-0.5">
              Logic Stream
            </span>
            <span className="text-[11px] font-medium text-slate-300">
              Frame {idx + 1} of {total} {subFrames.length > 0 && `(${idx + 1}.${subIdx + 1})`}
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
              "h-8 gap-2 rounded-lg border px-3 text-[10px] font-bold transition-all uppercase tracking-wider",
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
      <div className="relative flex-1 min-h-0 mesh-gradient overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${idx}-${subIdx}`}
            initial={{ opacity: 0, x: isForward ? 20 : -20, filter: "blur(10px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: isForward ? -20 : 20, filter: "blur(10px)" }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="h-full flex flex-col p-4 space-y-3"
          >
            {/* Compact Header */}
            <div className="shrink-0 flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <h3 className="text-base font-black text-white tracking-tight">
                  {displayFrame?.title}
                </h3>
                <p className="text-xs font-medium text-slate-400 leading-relaxed line-clamp-2">
                  {displayFrame?.narration}
                </p>
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
              {/* Code State - Flexible but bounded */}
              <div className="shrink-0 max-h-[35%] overflow-hidden group">
                <ExecutionStateView state={displayFrame?.code_state || ""} />
              </div>

              {/* Data Views (preferred) or Canvas Scene (fallback) - Flexible to fill remaining space */}
              <div className="flex-1 min-h-0 relative">
                {displayFrame?.data_views && displayFrame.data_views.length > 0 ? (
                  <motion.div
                    className="h-full overflow-y-auto pr-1 custom-scrollbar"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                  >
                    <DataViewRenderer views={displayFrame.data_views} speed={speed} />
                  </motion.div>
                ) : displayFrame?.canvas_scene && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="h-full w-full rounded-xl overflow-hidden border border-slate-700/60 shadow-inner"
                  >
                    <RuntimeManager scene={{
                      version: "1",
                      metadata: { title: "auto", description: "", totalDuration: 10 },
                      timeline: displayFrame.canvas_scene.nodes.map((n: CanvasNode, i: number) => ({
                        id: n.id,
                        type: n.type === "container" ? "stack_frame" : "runtime_variable",
                        start: 0,
                        duration: 10,
                        props: {
                          label: n.label,
                          value: n.value,
                          color: n.color,
                          parent: n.parent,
                          // If it has a parent, let SceneGraph handle layout, otherwise spread them
                          position: n.parent ? [0, 0, 0] : [(i % 3) * 4 - 4, 1, Math.floor(i / 3) * -4]
                        }
                      }))
                    }} />
                  </motion.div>
                )}

                {/* Effects Overlay */}
                {displayFrame.effects && displayFrame.effects.length > 0 && (
                  <motion.div 
                    className="absolute top-2 right-2 z-50 w-64 pointer-events-none"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <EffectLayer effects={displayFrame.effects} />
                  </motion.div>
                )}
              </div>
            </div>

            {/* Checkpoint UI - Absolute Overlay to not push content */}
            <AnimatePresence>
              {isCheckpoint && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
                  className="absolute inset-4 z-50 overflow-hidden rounded-2xl border border-amber-500/30 bg-slate-900/90 backdrop-blur-md p-6 shadow-2xl flex flex-col justify-center"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
                  
                  <div className="space-y-4 text-center max-w-lg mx-auto">
                    <div className="flex flex-col items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30 shadow-inner">
                          <Brain className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500 block mb-0.5">
                            Discovery Gate
                        </span>
                        <h4 className="text-xl font-bold text-white tracking-tight">Active Prediction Required</h4>
                    </div>
                      
                    <p className="text-base font-medium text-slate-200 leading-relaxed">
                        {mainFrame?.checkpoint_question ?? "Analyze the current state. What do you think happens next?"}
                    </p>
                      
                    <Button 
                        size="lg" 
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-10 h-12 rounded-xl shadow-lg transition-all"
                        onClick={handleClearCheckpoint}
                    >
                        Predict Outcome
                        <ChevronRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Auto-play progress bar */}
      {autoPlay && (idx < total - 1 || subIdx < subFrames.length - 1) && !isCheckpoint && (
        <div className="h-0.5 bg-slate-800 shrink-0">
          <div
            className="h-full bg-gradient-to-r from-fuchsia-500 via-sky-500 to-emerald-500"
            style={{ width: `${frameProgress}%`, transition: "none" }}
          />
        </div>
      )}

      {/* ── Controls ── */}
      <div className="border-t border-slate-700/50 px-5 py-3 flex items-center justify-between bg-slate-900/60 backdrop-blur-sm">
        <Button
          variant="outline"
          size="sm"
          onClick={prev}
          disabled={idx === 0 && subIdx === 0}
          className="h-8 gap-1.5 border-slate-700/60 bg-slate-800/40 text-slate-400 hover:text-slate-200 uppercase tracking-tighter font-bold text-[9px]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </Button>

        <div className="flex items-center gap-1.5">
          {frames.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              disabled={i > idx && isCheckpoint}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                i === idx
                  ? "w-6 bg-fuchsia-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]"
                  : i < idx
                    ? "w-1.5 bg-slate-500"
                    : "w-1.5 bg-slate-800",
                i > idx && isCheckpoint && "opacity-30 cursor-not-allowed"
              )}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={next}
          disabled={(idx === total - 1 && subIdx === subFrames.length - 1) || isCheckpoint}
          className={cn(
            "h-8 gap-1.5 border-slate-700/60 bg-slate-800/40 text-slate-400 hover:text-slate-200 uppercase tracking-tighter font-bold text-[9px]",
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
