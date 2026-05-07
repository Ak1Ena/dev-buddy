import { useState, useRef, useLayoutEffect } from "react";
import { motion } from "framer-motion";
import type { CanvasSceneData, CanvasNode, CanvasEdge } from "@/types";

// ── Palette (inline styles only — avoids dynamic Tailwind class purging) ──────
const PAL: Record<string, { bg: string; border: string; lbl: string; val: string; glow: string }> = {
  sky:     { bg: "rgba(14,165,233,0.1)",  border: "#0ea5e9", lbl: "#7dd3fc", val: "#38bdf8", glow: "rgba(14,165,233,0.28)"  },
  emerald: { bg: "rgba(16,185,129,0.1)",  border: "#10b981", lbl: "#6ee7b7", val: "#34d399", glow: "rgba(16,185,129,0.28)"  },
  fuchsia: { bg: "rgba(168,85,247,0.1)",  border: "#a855f7", lbl: "#d8b4fe", val: "#c084fc", glow: "rgba(168,85,247,0.28)"  },
  amber:   { bg: "rgba(245,158,11,0.1)",  border: "#f59e0b", lbl: "#fde68a", val: "#fbbf24", glow: "rgba(245,158,11,0.28)"  },
  red:     { bg: "rgba(239,68,68,0.1)",   border: "#ef4444", lbl: "#fca5a5", val: "#f87171", glow: "rgba(239,68,68,0.28)"   },
  slate:   { bg: "rgba(71,85,105,0.15)",  border: "#475569", lbl: "#cbd5e1", val: "#94a3b8", glow: "rgba(71,85,105,0.35)"   },
};

const H_GAP = 44;
const V_GAP = 56;
const PAD   = 28;

// ── Internal geometry types ───────────────────────────────────────────────────
interface Sz     { w: number; h: number }
interface Pos    { x: number; y: number }
interface Layout { positions: Map<string, Pos>; sizes: Map<string, Sz>; cw: number; ch: number }

// ── Layout: tree (when any node has parent) or flat (horizontal) ──────────────
function buildChildren(nodes: CanvasNode[]) {
  const m = new Map(nodes.map(n => [n.id, [] as string[]]));
  nodes.forEach(n => { if (n.parent) m.get(n.parent)?.push(n.id); });
  return m;
}

function subtreeW(id: string, ch: Map<string, string[]>, sz: Map<string, Sz>): number {
  const kids = ch.get(id) ?? [];
  const self = sz.get(id)?.w ?? 90;
  if (!kids.length) return self;
  return Math.max(self, kids.reduce((s, k) => s + subtreeW(k, ch, sz), 0) + H_GAP * (kids.length - 1));
}

function computeLayout(nodes: CanvasNode[], sz: Map<string, Sz>): Layout {
  const pos    = new Map<string, Pos>();
  const isTree = nodes.some(n => !!n.parent);

  if (isTree) {
    const ch = buildChildren(nodes);
    const sw = new Map(nodes.map(n => [n.id, subtreeW(n.id, ch, sz)]));

    function place(id: string, ox: number, y: number) {
      const { w, h } = sz.get(id)!;
      pos.set(id, { x: ox + (sw.get(id)! - w) / 2, y });
      let cx = ox;
      for (const kid of (ch.get(id) ?? [])) {
        place(kid, cx, y + h + V_GAP);
        cx += sw.get(kid)! + H_GAP;
      }
    }
    let ox = PAD;
    for (const root of nodes.filter(n => !n.parent)) {
      place(root.id, ox, PAD);
      ox += sw.get(root.id)! + H_GAP * 2;
    }
  } else {
    let x = PAD;
    for (const n of nodes) {
      pos.set(n.id, { x, y: PAD });
      x += sz.get(n.id)!.w + H_GAP;
    }
  }

  let maxX = 0, maxY = 0;
  for (const n of nodes) {
    const p = pos.get(n.id) ?? { x: 0, y: 0 };
    const s = sz.get(n.id) ?? { w: 0, h: 0 };
    maxX = Math.max(maxX, p.x + s.w);
    maxY = Math.max(maxY, p.y + s.h);
  }
  return { positions: pos, sizes: sz, cw: maxX + PAD, ch: maxY + PAD };
}

// ── SVG bezier path for parent→child connectors ───────────────────────────────
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const m = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${m}, ${x2} ${m}, ${x2} ${y2}`;
}

// ── Individual node box (HTML) ────────────────────────────────────────────────
function NodeBox({ node }: { node: CanvasNode }) {
  const p = PAL[node.color ?? "sky"] ?? PAL.sky;
  const hasValue = node.value !== undefined && node.value !== "";
  return (
    <div
      data-nid={node.id}
      className="rounded-[10px] font-mono whitespace-nowrap"
      style={{
        minWidth: 90,
        background: p.bg,
        border: `${node.highlight ? 2 : 1}px solid ${p.border}`,
        boxShadow: node.highlight
          ? `0 0 0 1px ${p.border}33, 0 0 20px 3px ${p.glow}`
          : undefined,
      }}
    >
      <p
        className="text-[9px] font-semibold tracking-wider text-center px-3.5 pt-2"
        style={{ color: p.lbl, paddingBottom: hasValue ? "4px" : "8px" }}
      >
        {node.label}
      </p>
      {hasValue && (
        <>
          <div className="mx-2.5" style={{ borderTop: `0.75px solid ${p.border}28` }} />
          <p
            className="text-[17px] font-bold text-center px-3.5 pb-2 pt-1.5"
            style={{ color: p.val }}
          >
            {node.value}
          </p>
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CanvasScene({ scene }: { scene: CanvasSceneData }) {
  const { nodes, edges = [] } = scene;
  const [layout, setLayout] = useState<Layout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Phase 1 — nodes render hidden at (0,0); measure their natural DOM size.
  // Phase 2 — compute positions; framer-motion animates nodes into place.
  // CanvasScene remounts per frame (parent AnimationPlayer uses key={idx}),
  // so layout always starts fresh.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !nodes.length) return;
    const sz = new Map<string, Sz>();
    for (const n of nodes) {
      const node = el.querySelector<HTMLDivElement>(`[data-nid="${n.id}"]`);
      if (!node) return; // not all nodes mounted yet — skip
      sz.set(n.id, { w: node.offsetWidth, h: node.offsetHeight });
    }
    setLayout(computeLayout(nodes, sz));
  }, [nodes, scene]);

  const ready = layout !== null;

  return (
    <div
      ref={containerRef}
      className="relative bg-slate-950 rounded-xl border border-slate-700/60 overflow-x-auto"
      style={ready ? { width: layout.cw, height: layout.ch } : { minHeight: 88 }}
    >
      {/* ── SVG lines (rendered behind nodes) ──────────────────────────────── */}
      {ready && (
        <svg
          width={layout.cw}
          height={layout.ch}
          className="absolute inset-0 pointer-events-none"
          style={{ overflow: "visible" }}
        >
          <defs>
            {Object.entries(PAL).map(([key, p]) => (
              <marker
                key={key}
                id={`arw-${key}`}
                markerUnits="userSpaceOnUse"
                markerWidth="10" markerHeight="8"
                refX="9" refY="4"
                orient="auto"
              >
                <path d="M 0 0.5 L 9 4 L 0 7.5 Z" fill={p.border} />
              </marker>
            ))}
          </defs>

          {/* Parent → child: animated bezier curves */}
          {nodes.map(node => {
            if (!node.parent) return null;
            const pp = layout.positions.get(node.parent);
            const np = layout.positions.get(node.id);
            const ps = layout.sizes.get(node.parent);
            const ns = layout.sizes.get(node.id);
            if (!pp || !np || !ps || !ns) return null;
            const parentColor = nodes.find(n => n.id === node.parent)?.color ?? "slate";
            const col = (PAL[parentColor] ?? PAL.slate).border;
            return (
              <motion.path
                key={`crv-${node.id}`}
                d={bezier(pp.x + ps.w / 2, pp.y + ps.h, np.x + ns.w / 2, np.y)}
                fill="none"
                stroke={col}
                strokeWidth={1.5}
                strokeOpacity={0.5}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.45, delay: 0.12, ease: "easeOut" }}
              />
            );
          })}

          {/* Edges: directional arrows */}
          {(edges as CanvasEdge[]).map((edge, i) => {
            const fp = layout.positions.get(edge.from);
            const tp = layout.positions.get(edge.to);
            const fs = layout.sizes.get(edge.from);
            const ts = layout.sizes.get(edge.to);
            if (!fp || !tp || !fs || !ts) return null;
            const colorKey = nodes.find(n => n.id === edge.from)?.color ?? "sky";
            const p = PAL[colorKey] ?? PAL.sky;
            const x1 = fp.x + fs.w + 2;
            const y1 = fp.y + fs.h / 2;
            const x2 = tp.x - 2;
            const y2 = tp.y + ts.h / 2;
            return (
              <g key={i}>
                <motion.line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={p.border}
                  strokeWidth={1.5}
                  strokeOpacity={0.7}
                  strokeDasharray={edge.style === "dashed" ? "5 4" : undefined}
                  markerEnd={`url(#arw-${colorKey})`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                />
                {edge.label && (
                  <text
                    x={(x1 + x2) / 2}
                    y={Math.min(fp.y, tp.y) - 7}
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="ui-monospace, SFMono-Regular, monospace"
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}

      {/* ── Node boxes ─────────────────────────────────────────────────────── */}
      {nodes.map((node, i) => {
        const pos = layout?.positions.get(node.id);
        return (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: ready ? 1 : 0, scale: ready ? 1 : 0.88 }}
            transition={{ duration: 0.22, delay: ready ? i * 0.05 : 0, ease: "easeOut" }}
            style={
              ready && pos
                ? { position: "absolute", left: pos.x, top: pos.y }
                : { position: "absolute", left: 0, top: 0, pointerEvents: "none" }
            }
          >
            <NodeBox node={node} />
          </motion.div>
        );
      })}
    </div>
  );
}
