import { useEffect, useRef } from "react";
import type { CanvasSceneData, CanvasNode, CanvasEdge } from "@/types";

// ── Palette ───────────────────────────────────────────────────────────────────
const PAL: Record<string, { bg: string; border: string; val: string; lbl: string }> = {
  sky:     { bg: "rgba(14,165,233,.12)",  border: "#0ea5e9", val: "#38bdf8", lbl: "#7dd3fc" },
  emerald: { bg: "rgba(16,185,129,.12)",  border: "#10b981", val: "#34d399", lbl: "#6ee7b7" },
  fuchsia: { bg: "rgba(168,85,247,.12)",  border: "#a855f7", val: "#c084fc", lbl: "#d8b4fe" },
  amber:   { bg: "rgba(245,158,11,.12)",  border: "#f59e0b", val: "#fbbf24", lbl: "#fde68a" },
  red:     { bg: "rgba(239,68,68,.12)",   border: "#ef4444", val: "#f87171", lbl: "#fca5a5" },
  slate:   { bg: "rgba(71,85,105,.15)",   border: "#475569", val: "#94a3b8", lbl: "#cbd5e1" },
};

// ── Layout constants ──────────────────────────────────────────────────────────
const H_GAP   = 44;   // gap between siblings / horizontal nodes
const V_GAP   = 52;   // gap between tree levels
const PAD     = 32;   // canvas outer padding
const MIN_W   = 90;   // minimum node width
const IPAD    = 16;   // inner horizontal padding per side
const H_VAL   = 66;   // node height when value row present
const H_NOVAL = 36;   // node height when no value

const LBL_FONT = "600 9px ui-monospace, SFMono-Regular, monospace";
const VAL_FONT = "bold 17px ui-monospace, SFMono-Regular, monospace";

// ── Internal types ────────────────────────────────────────────────────────────
interface Sz  { w: number; h: number }
interface Pos { x: number; y: number }

// ── Rounded rect path ─────────────────────────────────────────────────────────
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

// ── Measure each node's natural size based on its text ────────────────────────
function measureNodes(nodes: CanvasNode[]): Map<string, Sz> {
  const mc = document.createElement("canvas").getContext("2d")!;
  return new Map(nodes.map(node => {
    mc.font = LBL_FONT;
    const lw = mc.measureText(node.label).width;
    mc.font = VAL_FONT;
    const vw = node.value ? mc.measureText(String(node.value)).width : 0;
    return [
      node.id,
      {
        w: Math.max(MIN_W, Math.ceil(Math.max(lw, vw) + IPAD * 2)),
        h: node.value ? H_VAL : H_NOVAL,
      },
    ];
  }));
}

// ── Build parent → [children] map ─────────────────────────────────────────────
function buildChildren(nodes: CanvasNode[]): Map<string, string[]> {
  const m = new Map(nodes.map(n => [n.id, [] as string[]]));
  nodes.forEach(n => { if (n.parent) m.get(n.parent)?.push(n.id); });
  return m;
}

// ── Width of the subtree rooted at id ────────────────────────────────────────
function subtreeW(
  id: string,
  ch: Map<string, string[]>,
  sz: Map<string, Sz>,
): number {
  const kids = ch.get(id) ?? [];
  const self = sz.get(id)?.w ?? MIN_W;
  if (!kids.length) return self;
  const kidsTotal = kids.reduce((s, k) => s + subtreeW(k, ch, sz), 0)
    + H_GAP * (kids.length - 1);
  return Math.max(self, kidsTotal);
}

// ── Tree layout (DFS, Reingold-Tilford-style allocation) ──────────────────────
function treeLayout(nodes: CanvasNode[], sz: Map<string, Sz>): Map<string, Pos> {
  const pos = new Map<string, Pos>();
  const ch  = buildChildren(nodes);
  const sw  = new Map(nodes.map(n => [n.id, subtreeW(n.id, ch, sz)]));

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
  return pos;
}

// ── Horizontal layout (original flat layout) ──────────────────────────────────
function hLayout(nodes: CanvasNode[], sz: Map<string, Sz>): Map<string, Pos> {
  const pos = new Map<string, Pos>();
  let x = PAD;
  for (const n of nodes) {
    pos.set(n.id, { x, y: PAD });
    x += sz.get(n.id)!.w + H_GAP;
  }
  return pos;
}

// ── Arrow (for edges[]) ───────────────────────────────────────────────────────
function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  col: string,
  dashed: boolean,
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const TIP = 8;
  ctx.globalAlpha = 0.65;
  ctx.strokeStyle = col;
  ctx.lineWidth   = 1.5;
  ctx.setLineDash(dashed ? [5, 4] : []);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - TIP * Math.cos(angle), y2 - TIP * Math.sin(angle));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - TIP * Math.cos(angle - Math.PI / 6), y2 - TIP * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - TIP * Math.cos(angle + Math.PI / 6), y2 - TIP * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

// ── Cubic bezier (for parent→child) ──────────────────────────────────────────
function drawCurve(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  col: string,
) {
  const mid = (y1 + y2) / 2;
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = col;
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.bezierCurveTo(x1, mid, x2, mid, x2, y2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // dot at child end
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x2, y2, 3, 0, Math.PI * 2);
  ctx.fill();
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CanvasScene({ scene }: { scene: CanvasSceneData }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { nodes, edges = [] } = scene;
    if (!nodes.length) return;

    // 1. Measure each node's natural size
    const sz = measureNodes(nodes);

    // 2. Choose layout: tree when any node declares a parent
    const isTree = nodes.some(n => !!n.parent);
    const pos = isTree ? treeLayout(nodes, sz) : hLayout(nodes, sz);

    // 3. Canvas size = bounding box of all nodes + padding
    let maxX = 0, maxY = 0;
    for (const n of nodes) {
      const { x, y } = pos.get(n.id)!;
      const { w, h } = sz.get(n.id)!;
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }
    const CW = maxX + PAD;
    const CH = maxY + PAD;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = CW * dpr;
    canvas.height = CH * dpr;
    canvas.style.width  = `${CW}px`;
    canvas.style.height = `${CH}px`;
    ctx.scale(dpr, dpr);

    // 4. Background
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, CW, CH);

    // 5. Parent→child bezier curves (drawn beneath nodes)
    for (const node of nodes) {
      if (!node.parent) continue;
      const pp = pos.get(node.parent);
      const np = pos.get(node.id);
      const ps = sz.get(node.parent);
      const ns = sz.get(node.id);
      if (!pp || !np || !ps || !ns) continue;
      const parentNode = nodes.find(n => n.id === node.parent);
      const col = (PAL[parentNode?.color ?? "slate"] ?? PAL.slate).border;
      drawCurve(
        ctx,
        pp.x + ps.w / 2, pp.y + ps.h,   // parent bottom-center
        np.x + ns.w / 2, np.y,           // child top-center
        col,
      );
    }

    // 6. Regular edges (arrows, from edges[])
    for (const edge of (edges as CanvasEdge[])) {
      const fp = pos.get(edge.from);
      const tp = pos.get(edge.to);
      const fs = sz.get(edge.from);
      const ts = sz.get(edge.to);
      if (!fp || !tp || !fs || !ts) continue;
      const srcNode = nodes.find(n => n.id === edge.from);
      const col = (PAL[srcNode?.color ?? "sky"] ?? PAL.sky).border;
      drawArrow(
        ctx,
        fp.x + fs.w, fp.y + fs.h / 2,
        tp.x,        tp.y + ts.h / 2,
        col,
        edge.style === "dashed",
      );
      if (edge.label) {
        ctx.fillStyle  = "#64748b";
        ctx.font       = "600 10px ui-monospace, SFMono-Regular, monospace";
        ctx.textAlign  = "center";
        ctx.fillText(edge.label, (fp.x + fs.w + tp.x) / 2, Math.min(fp.y, tp.y) - 6);
      }
    }

    // 7. Draw nodes
    for (const node of nodes) {
      const { x, y } = pos.get(node.id)!;
      const { w, h } = sz.get(node.id)!;
      const p = PAL[node.color ?? "sky"] ?? PAL.sky;

      // Glow behind highlighted node
      if (node.highlight) {
        ctx.save();
        ctx.shadowColor = p.border;
        ctx.shadowBlur  = 22;
        ctx.strokeStyle = p.border;
        ctx.lineWidth   = 2;
        rr(ctx, x - 3, y - 3, w + 6, h + 6, 13);
        ctx.stroke();
        ctx.restore();
      }

      // Fill
      ctx.fillStyle = p.bg;
      rr(ctx, x, y, w, h, 10);
      ctx.fill();

      // Border
      ctx.strokeStyle = p.border;
      ctx.lineWidth   = node.highlight ? 2 : 1;
      rr(ctx, x, y, w, h, 10);
      ctx.stroke();

      // Label
      ctx.fillStyle  = p.lbl;
      ctx.font       = LBL_FONT;
      ctx.textAlign  = "center";
      ctx.fillText(node.label, x + w / 2, y + (node.value ? 14 : h / 2 + 4));

      // Divider + value (only when value present)
      if (node.value) {
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = p.border;
        ctx.lineWidth   = 0.75;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 24);
        ctx.lineTo(x + w - 10, y + 24);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.fillStyle  = p.val;
        ctx.font       = VAL_FONT;
        ctx.textAlign  = "center";
        ctx.fillText(String(node.value), x + w / 2, y + h / 2 + 13);
      }
    }
  }, [scene]);

  return (
    <div className="rounded-xl overflow-x-auto border border-slate-700/60">
      <canvas ref={ref} className="block" />
    </div>
  );
}
