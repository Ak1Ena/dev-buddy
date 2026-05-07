import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface AnimationEffect {
  effect: "pulse" | "flow" | "spawn" | "highlight" | "burst" | "fade";
  target?: string;
  from?: string;
  to?: string;
  label?: string;
  color?: "sky" | "amber" | "emerald" | "fuchsia" | "red" | "slate";
}

const C = {
  sky:     { bg: "bg-sky-500/10",     border: "border-sky-500/30",     text: "text-sky-300",     dot: "bg-sky-400" },
  amber:   { bg: "bg-amber-500/10",   border: "border-amber-500/30",   text: "text-amber-300",   dot: "bg-amber-400" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-300", dot: "bg-emerald-400" },
  fuchsia: { bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/30", text: "text-fuchsia-300", dot: "bg-fuchsia-400" },
  red:     { bg: "bg-red-500/10",     border: "border-red-500/30",     text: "text-red-300",     dot: "bg-red-400" },
  slate:   { bg: "bg-slate-500/10",   border: "border-slate-500/30",   text: "text-slate-300",   dot: "bg-slate-400" },
} as const;

type ColorKey = keyof typeof C;
const color = (k?: string): ColorKey => (k && k in C ? (k as ColorKey) : "sky");

// ── Pulse: radial ring + pulsing dot, value just changed ────────────────────
function Pulse({ e, i }: { e: AnimationEffect; i: number }) {
  const c = C[color(e.color)];
  return (
    <motion.div
      className={cn("flex items-center gap-3 rounded-xl border px-4 py-2.5", c.bg, c.border)}
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: i * 0.11, type: "spring", stiffness: 380, damping: 22 }}
    >
      <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        <motion.div
          className={cn("absolute h-6 w-6 rounded-full", c.dot)}
          animate={{ scale: [1, 2, 1], opacity: [0.35, 0, 0.35] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className={cn("h-2.5 w-2.5 rounded-full", c.dot)} />
      </div>
      <div>
        <p className="text-xs">
          {e.target && <span className={cn("font-mono font-bold", c.text)}>{e.target}</span>}
          {e.label && <span className="ml-1.5 text-slate-400">{e.label}</span>}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-600">pulse · value changed</p>
      </div>
    </motion.div>
  );
}

// ── Flow: animated dots moving from → to ────────────────────────────────────
function Flow({ e, i }: { e: AnimationEffect; i: number }) {
  const c = C[color(e.color)];
  return (
    <motion.div
      className={cn("flex items-center gap-3 rounded-xl border px-4 py-2.5", c.bg, c.border)}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.11, duration: 0.3 }}
    >
      <span className={cn("shrink-0 font-mono text-xs font-bold", c.text)}>{e.from ?? "src"}</span>
      <div className="relative flex h-4 flex-1 items-center overflow-hidden">
        {[0, 1, 2, 3, 4].map((d) => (
          <motion.div
            key={d}
            className={cn("absolute h-1.5 w-1.5 rounded-full", c.dot)}
            style={{ left: 0 }}
            animate={{ left: ["0%", "100%"] }}
            transition={{ duration: 1.1, delay: d * 0.2, repeat: Infinity, ease: "linear" }}
          />
        ))}
      </div>
      <div className="shrink-0 text-right">
        <span className={cn("font-mono text-xs font-bold", c.text)}>{e.to ?? "dst"}</span>
        {e.label && <p className="text-[10px] text-slate-500">{e.label}</p>}
      </div>
    </motion.div>
  );
}

// ── Spawn: burst particles + label ──────────────────────────────────────────
function Spawn({ e, i }: { e: AnimationEffect; i: number }) {
  const c = C[color(e.color)];
  const pts = Array.from({ length: 8 }, (_, k) => k);
  return (
    <motion.div
      className={cn("flex items-center gap-3 rounded-xl border px-4 py-2.5", c.bg, c.border)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.11, duration: 0.3 }}
    >
      <div className="relative h-8 w-8 shrink-0">
        {pts.map((p) => {
          const rad = ((p / pts.length) * 360 * Math.PI) / 180;
          return (
            <motion.div
              key={p}
              className={cn("absolute left-1/2 top-1/2 h-1 w-1 rounded-full", c.dot)}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: Math.cos(rad) * 14, y: Math.sin(rad) * 14, opacity: 0, scale: 0 }}
              transition={{ duration: 0.65, delay: i * 0.11 + 0.05, ease: "easeOut" }}
            />
          );
        })}
        <motion.div
          className={cn("absolute inset-0 rounded-full", c.dot, "opacity-0")}
          animate={{ opacity: [0, 0.3, 0], scale: [0.5, 1.6, 1] }}
          transition={{ duration: 0.55, delay: i * 0.11 }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className={cn("h-3 w-3 rounded-full", c.dot)}
            animate={{ scale: [0, 1.3, 1] }}
            transition={{ duration: 0.4, delay: i * 0.11 }}
          />
        </div>
      </div>
      <div>
        <p className="text-xs">
          {e.target && <span className={cn("font-mono font-bold", c.text)}>{e.target}</span>}
          {e.label && <span className="ml-1.5 text-slate-400">{e.label}</span>}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-600">spawn · created</p>
      </div>
    </motion.div>
  );
}

// ── Highlight: growing accent bar, condition true ────────────────────────────
function Highlight({ e, i }: { e: AnimationEffect; i: number }) {
  const c = C[color(e.color)];
  return (
    <motion.div
      className={cn("flex items-center gap-3 rounded-xl border px-4 py-2.5", c.bg, c.border)}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: i * 0.11 }}
    >
      <motion.div
        className={cn("w-1 self-stretch rounded-full", c.dot)}
        style={{ originY: 0 }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: i * 0.11 + 0.1, duration: 0.35 }}
      />
      <div>
        <p className="text-xs">
          {e.target && <span className={cn("font-mono font-bold", c.text)}>{e.target}</span>}
          {e.label && <span className="ml-1.5 text-slate-400">{e.label}</span>}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-600">highlight · condition true</p>
      </div>
    </motion.div>
  );
}

// ── Burst: quick shake + lightning bolt ─────────────────────────────────────
function Burst({ e, i }: { e: AnimationEffect; i: number }) {
  const c = C[color(e.color)];
  return (
    <motion.div
      className={cn("flex items-center gap-3 rounded-xl border px-4 py-2.5", c.bg, c.border)}
      initial={{ opacity: 0, scale: 1.08 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: i * 0.11, type: "spring", stiffness: 420, damping: 18 }}
    >
      <motion.span
        className="shrink-0 text-lg leading-none"
        animate={{ rotate: [0, 18, -18, 0] }}
        transition={{ duration: 0.35, delay: i * 0.11 + 0.05 }}
      >
        ⚡
      </motion.span>
      <div>
        <p className="text-xs">
          {e.target && <span className={cn("font-mono font-bold", c.text)}>{e.target}</span>}
          {e.label && <span className="ml-1.5 text-slate-400">{e.label}</span>}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-600">burst · event fired</p>
      </div>
    </motion.div>
  );
}

// ── Fade: strikethrough + dimming, scope ended ───────────────────────────────
function Fade({ e, i }: { e: AnimationEffect; i: number }) {
  const c = C[color(e.color)];
  return (
    <motion.div
      className={cn("flex items-center gap-3 rounded-xl border px-4 py-2.5", c.bg, c.border)}
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 0.35, 0.6] }}
      transition={{ delay: i * 0.11, duration: 0.9, times: [0, 0.5, 1] }}
    >
      <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full opacity-30", c.dot)} />
      <div>
        <p className="text-xs">
          {e.target && <span className={cn("font-mono font-bold line-through opacity-40", c.text)}>{e.target}</span>}
          {e.label && <span className="ml-1.5 text-slate-500">{e.label}</span>}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-600">fade · scope ended</p>
      </div>
    </motion.div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function EffectLayer({ effects }: { effects: AnimationEffect[] }) {
  if (!effects || effects.length === 0) return null;
  return (
    <div className="space-y-2">
      {effects.map((e, i) => {
        switch (e.effect) {
          case "pulse":     return <Pulse     key={i} e={e} i={i} />;
          case "flow":      return <Flow      key={i} e={e} i={i} />;
          case "spawn":     return <Spawn     key={i} e={e} i={i} />;
          case "highlight": return <Highlight key={i} e={e} i={i} />;
          case "burst":     return <Burst     key={i} e={e} i={i} />;
          case "fade":      return <Fade      key={i} e={e} i={i} />;
          default:          return null;
        }
      })}
    </div>
  );
}
