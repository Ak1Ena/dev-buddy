import { useEffect, useRef, useMemo, useState } from "react";
import type { CanvasSceneData, CanvasNode, CanvasEdge } from "@/types";

// ── Palette ───────────────────────────────────────────────────────────────────
const PAL: Record<string, { bg: string; border: string; val: string; lbl: string }> = {
  sky:     { bg: "rgba(14,165,233,.12)",  border: "#0ea5e9", val: "#38bdf8", lbl: "#7dd3fc" },
  emerald: { bg: "rgba(16,185,129,.12)",  border: "#10b981", val: "#34d399", lbl: "#6ee7b7" },
  fuchsia: { bg: "rgba(217, 70, 239, .12)",  border: "#D946EF", val: "#f0abfc", lbl: "#f5d0fe" },
  amber:   { bg: "rgba(245,158,11,.12)",  border: "#f59e0b", val: "#fbbf24", lbl: "#fde68a" },
  red:     { bg: "rgba(239,68,68,.12)",   border: "#ef4444", val: "#f87171", lbl: "#fca5a5" },
  slate:   { bg: "rgba(71,85,105,.15)",   border: "#475569", val: "#94a3b8", lbl: "#cbd5e1" },
};

const H_GAP   = 44;
const V_GAP   = 52;
const PAD     = 32;
const MIN_W   = 90;
const IPAD    = 16;
const H_VAL   = 66;
const H_NOVAL = 36;

const LBL_FONT = "600 9px ui-monospace, SFMono-Regular, monospace";
const VAL_FONT = "bold 17px ui-monospace, SFMono-Regular, monospace";

interface Sz  { w: number; h: number }
interface Pos { x: number; y: number }

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
}

function drawPill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + r, r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

const LBL_CHAR_PX = 5.6;
const VAL_CHAR_PX = 10.4;

function measureNodes(nodes: CanvasNode[], ctx: CanvasRenderingContext2D): Map<string, Sz> {
  return new Map(nodes.map(node => {
    ctx.font = LBL_FONT;
    const lwMeasured = ctx.measureText(node.label).width;
    const lw = Math.max(lwMeasured, node.label.length * LBL_CHAR_PX);

    const valStr = node.value != null ? String(node.value) : "";
    let vw = 0;
    if (valStr) {
      ctx.font = VAL_FONT;
      const vwMeasured = ctx.measureText(valStr).width;
      vw = Math.max(vwMeasured, valStr.length * VAL_CHAR_PX);
    }

    let w = Math.max(MIN_W, Math.ceil(Math.max(lw, vw) + IPAD * 2));
    let h = node.value ? H_VAL : H_NOVAL;
    
    // Diamond needs more width to look balanced
    if (node.type === "decision") {
      w = Math.max(w, h * 1.5);
      h = Math.max(h, w / 1.5);
    }

    return [node.id, { w, h }];
  }));
}

function buildChildren(nodes: CanvasNode[]): Map<string, string[]> {
  const m = new Map(nodes.map(n => [n.id, [] as string[]]));
  nodes.forEach(n => {
    if (n.parent && m.has(n.parent)) {
      m.get(n.parent)?.push(n.id);
    }
  });
  return m;
}

function subtreeW(id: string, ch: Map<string, string[]>, sz: Map<string, Sz>, visited = new Set<string>()): number {
  if (visited.has(id)) return 0;
  visited.add(id);
  
  const kids = ch.get(id) ?? [];
  const self = sz.get(id)?.w ?? MIN_W;
  if (!kids.length) return self;
  
  const kidsWidth = kids.reduce((s, k) => s + subtreeW(k, ch, sz, visited), 0) + H_GAP * (kids.length - 1);
  return Math.max(self, kidsWidth);
}

function treeLayout(nodes: CanvasNode[], sz: Map<string, Sz>): Map<string, Pos> {
  const pos = new Map<string, Pos>();
  const ch  = buildChildren(nodes);
  const sw  = new Map(nodes.map(n => [n.id, subtreeW(n.id, ch, sz, new Set())]));

  function place(id: string, ox: number, y: number, visited = new Set<string>()) {
    if (visited.has(id)) return;
    visited.add(id);
    
    const nodeSz = sz.get(id);
    if (!nodeSz) return;
    const { w, h } = nodeSz;
    
    const nodeSw = sw.get(id) ?? w;
    pos.set(id, { x: ox + (nodeSw - w) / 2, y });
    
    let cx = ox;
    for (const kid of (ch.get(id) ?? [])) {
      place(kid, cx, y + h + V_GAP, visited);
      cx += (sw.get(kid) ?? MIN_W) + H_GAP;
    }
  }

  let ox = PAD;
  // A root is a node with no parent, OR a parent that doesn't exist in the current set
  const roots = nodes.filter(n => !n.parent || !nodes.find(p => p.id === n.parent));
  for (const root of roots) {
    place(root.id, ox, PAD);
    ox += (sw.get(root.id) ?? MIN_W) + H_GAP * 2;
  }
  return pos;
}

function hLayout(nodes: CanvasNode[], sz: Map<string, Sz>): Map<string, Pos> {
  const pos = new Map<string, Pos>();
  let x = PAD;
  for (const n of nodes) {
    const nodeSz = sz.get(n.id);
    if (nodeSz) {
      pos.set(n.id, { x, y: PAD });
      x += nodeSz.w + H_GAP;
    }
  }
  return pos;
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(56, 189, 248, 0.04)";
  ctx.lineWidth = 1;

  // Major grid
  const step = 40;
  ctx.beginPath();
  for (let x = 0; x <= w; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = 0; y <= h; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  // Minor grid
  ctx.strokeStyle = "rgba(56, 189, 248, 0.02)";
  const smallStep = 10;
  ctx.beginPath();
  for (let x = 0; x <= w; x += smallStep) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = 0; y <= h; y += smallStep) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, col: string, dashed: boolean, progress: number = 1) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const TIP = 8;
  const length = Math.hypot(x2 - x1, y2 - y1);
  const drawLen = length * progress;

  ctx.globalAlpha = 0.65;
  ctx.strokeStyle = col;
  ctx.lineWidth   = 1.5;
  
  if (progress < 1) {
    ctx.setLineDash([drawLen, length]);
  } else {
    ctx.setLineDash(dashed ? [5, 4] : []);
  }

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  
  if (progress > 0.95) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - TIP * Math.cos(angle - Math.PI / 6), y2 - TIP * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - TIP * Math.cos(angle + Math.PI / 6), y2 - TIP * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCurve(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, col: string, progress: number = 1) {
  const mid = (y1 + y2) / 2;
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = col;
  ctx.lineWidth   = 1.5;
  
  // Bezier length approximation
  const length = Math.hypot(x2 - x1, y2 - y1) * 1.2; 
  const drawLen = length * progress;

  if (progress < 1) {
    ctx.setLineDash([drawLen, length]);
  } else {
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.bezierCurveTo(x1, mid, x2, mid, x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (progress > 0.95) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x2, y2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const PARTICLE_VELOCITY = 0.09;
const PARTICLES_PER_EDGE = 3;
const PARTICLE_RADIUS = 2.6;
const TIP = 8;

function edgeProgress(elapsedMs: number, length: number, particleIndex: number): number {
  const period = Math.max(length / PARTICLE_VELOCITY, 600);
  return ((elapsedMs / period) + particleIndex / PARTICLES_PER_EDGE) % 1;
}

function drawParticlesOnLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  col: string, elapsedMs: number
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const ex = x2 - TIP * Math.cos(angle);
  const ey = y2 - TIP * Math.sin(angle);
  const length = Math.hypot(ex - x1, ey - y1);
  for (let i = 0; i < PARTICLES_PER_EDGE; i++) {
    const u = edgeProgress(elapsedMs, length, i);
    const fade = u < 0.1 ? u / 0.1 : u > 0.9 ? (1 - u) / 0.1 : 1;
    const px = x1 + (ex - x1) * u;
    const py = y1 + (ey - y1) * u;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.shadowColor = col;
    ctx.shadowBlur = 8;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(px, py, PARTICLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawParticlesOnBezier(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  col: string, elapsedMs: number
) {
  const mid = (y1 + y2) / 2;
  let length = 0;
  let prevX = x1, prevY = y1;
  for (let s = 1; s <= 8; s++) {
    const u = s / 8;
    const v = 1 - u;
    const sx = v*v*v*x1 + 3*v*v*u*x1 + 3*v*u*u*x2 + u*u*u*x2;
    const sy = v*v*v*y1 + 3*v*v*u*mid + 3*v*u*u*mid + u*u*u*y2;
    length += Math.hypot(sx - prevX, sy - prevY);
    prevX = sx; prevY = sy;
  }
  for (let i = 0; i < PARTICLES_PER_EDGE; i++) {
    const u = edgeProgress(elapsedMs, length, i);
    const fade = u < 0.1 ? u / 0.1 : u > 0.9 ? (1 - u) / 0.1 : 1;
    const v = 1 - u;
    const px = v*v*v*x1 + 3*v*v*u*x1 + 3*v*u*u*x2 + u*u*u*x2;
    const py = v*v*v*y1 + 3*v*v*u*mid + 3*v*u*u*mid + u*u*u*y2;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.shadowColor = col;
    ctx.shadowBlur = 8;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(px, py, PARTICLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export default function CanvasScene({ scene, highlightedNodeIds = [] }: { scene: CanvasSceneData, highlightedNodeIds?: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [isInView, setIsInView] = useState(false);

  const nodes = scene?.nodes || [];
  const edges = scene?.edges || [];

  // Memoize layout and measurements
  const layout = useMemo(() => {
    if (!nodes || nodes.length === 0) return null;
    
    // Create a temporary context for measurement
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const sz = measureNodes(nodes, ctx);
    const isTree = nodes.some(n => !!n.parent);
    const pos = isTree ? treeLayout(nodes, sz) : hLayout(nodes, sz);

    let maxX = 0, maxY = 0;
    for (const n of nodes) {
      const p = pos.get(n.id);
      const s = sz.get(n.id);
      if (p && s) {
        maxX = Math.max(maxX, p.x + s.w);
        maxY = Math.max(maxY, p.y + s.h);
      }
    }
    const CW = maxX + PAD;
    const CH = maxY + PAD;

    return { sz, pos, CW, CH, nodes, edges };
  }, [nodes, edges]);

  // Intersection Observer to stop animation when not visible
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting);
    }, { threshold: 0.1 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !layout) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { sz, pos, CW, CH, nodes, edges } = layout;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = CW * dpr;
    canvas.height = CH * dpr;
    canvas.style.width  = `${CW}px`;
    canvas.style.height = `${CH}px`;
    ctx.scale(dpr, dpr);

    let rafId = 0;
    let start = 0;

    const hasAnimation = nodes.some(n => !!n.parent) || edges.length > 0 || highlightedNodeIds.length > 0;

    const render = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start;

      // background
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, CW, CH);
      
      // Blueprint grid
      drawGrid(ctx, CW, CH);

      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Animation progress for drawing lines (1.2s duration)
      const drawProgress = Math.min(1, elapsed / 1200);

      // Parent→child curves
      for (const node of nodes) {
        if (!node.parent) continue;
        const pp = pos.get(node.parent);
        const np = pos.get(node.id);
        const ps = sz.get(node.parent);
        const ns = sz.get(node.id);
        if (!pp || !np || !ps || !ns) continue;
        const parentNode = nodes.find(n => n.id === node.parent);
        const col = (PAL[parentNode?.color ?? "slate"] ?? PAL.slate).border;
        const x1 = pp.x + ps.w / 2;
        const y1 = pp.y + ps.h;
        const x2 = np.x + ns.w / 2;
        const y2 = np.y;
        drawCurve(ctx, x1, y1, x2, y2, col, drawProgress);
        if (drawProgress > 0.8) {
           drawParticlesOnBezier(ctx, x1, y1, x2, y2, col, elapsed);
        }
      }

      const edgeList = edges as CanvasEdge[];
      const outTotal = new Map<string, number>();
      const inTotal  = new Map<string, number>();
      for (const e of edgeList) {
        outTotal.set(e.from, (outTotal.get(e.from) ?? 0) + 1);
        inTotal.set(e.to,    (inTotal.get(e.to)    ?? 0) + 1);
      }
      const outSeen = new Map<string, number>();
      const inSeen  = new Map<string, number>();

      for (const edge of edgeList) {
        const fp = pos.get(edge.from);
        const tp = pos.get(edge.to);
        const fs = sz.get(edge.from);
        const ts = sz.get(edge.to);
        if (!fp || !tp || !fs || !ts) continue;
        const srcNode = nodes.find(n => n.id === edge.from);
        const col = (PAL[srcNode?.color ?? "sky"] ?? PAL.sky).border;

        const oc = outTotal.get(edge.from) ?? 1;
        const oi = outSeen.get(edge.from)  ?? 0;
        outSeen.set(edge.from, oi + 1);
        const ic = inTotal.get(edge.to) ?? 1;
        const ii = inSeen.get(edge.to)  ?? 0;
        inSeen.set(edge.to, ii + 1);

        const x1 = fp.x + fs.w;
        const y1 = fp.y + fs.h * ((oi + 1) / (oc + 1));
        const x2 = tp.x;
        const y2 = tp.y + ts.h * ((ii + 1) / (ic + 1));

        drawArrow(ctx, x1, y1, x2, y2, col, edge.style === "dashed", drawProgress);
        if (drawProgress > 0.8) {
          drawParticlesOnLine(ctx, x1, y1, x2, y2, col, elapsed);
        }
        if (edge.label && drawProgress > 0.9) {
          ctx.fillStyle  = "#64748b";
          ctx.font       = "600 10px ui-monospace, SFMono-Regular, monospace";
          ctx.textAlign  = "center";
          ctx.fillText(edge.label, (x1 + x2) / 2, (y1 + y2) / 2 - 7);
        }
      }

      // Nodes
      for (const node of nodes) {
        const p_pos = pos.get(node.id);
        const p_sz = sz.get(node.id);
        if (!p_pos || !p_sz) continue;
        
        const { x, y } = p_pos;
        const { w, h } = p_sz;
        const p = PAL[node.color ?? (node.type === "decision" ? "fuchsia" : node.type === "outcome" ? "emerald" : "sky")] ?? PAL.sky;
        
        const isCurrentlyHighlighted = node.highlight || highlightedNodeIds.includes(node.id);

        if (isCurrentlyHighlighted) {
          const pulse = (Math.sin(elapsed / 200) + 1) / 2; // 0 to 1
          ctx.save();
          ctx.shadowColor = p.border;
          ctx.shadowBlur  = 15 + (pulse * 15);
          ctx.strokeStyle = p.border;
          ctx.lineWidth   = 2 + (pulse * 1);
          if (node.type === "decision") drawDiamond(ctx, x - 3, y - 3, w + 6, h + 6);
          else if (node.type === "outcome") drawPill(ctx, x - 3, y - 3, w + 6, h + 6);
          else drawRoundedRect(ctx, x - 3, y - 3, w + 6, h + 6, 13);
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = p.bg;
        if (node.type === "decision") drawDiamond(ctx, x, y, w, h);
        else if (node.type === "outcome") drawPill(ctx, x, y, w, h);
        else drawRoundedRect(ctx, x, y, w, h, 10);
        ctx.fill();

        ctx.strokeStyle = p.border;
        ctx.lineWidth   = isCurrentlyHighlighted ? 2 : 1;
        if (node.type === "decision") drawDiamond(ctx, x, y, w, h);
        else if (node.type === "outcome") drawPill(ctx, x, y, w, h);
        else drawRoundedRect(ctx, x, y, w, h, 10);
        ctx.stroke();

        ctx.fillStyle  = p.lbl;
        ctx.font       = LBL_FONT;
        ctx.textAlign  = "center";
        ctx.fillText(node.label, x + w / 2, y + (node.value ? (node.type === "decision" ? h / 2 - 4 : 14) : h / 2 + 4));

        if (node.value) {
          ctx.globalAlpha = 0.18;
          ctx.strokeStyle = p.border;
          ctx.lineWidth   = 0.75;
          ctx.beginPath();
          ctx.moveTo(x + 10, y + (node.type === "decision" ? h / 2 + 4 : 24));
          ctx.lineTo(x + w - 10, y + (node.type === "decision" ? h / 2 + 4 : 24));
          ctx.stroke();
          ctx.globalAlpha = 1;

          ctx.fillStyle  = p.val;
          ctx.font       = VAL_FONT;
          ctx.textAlign  = "center";
          ctx.fillText(String(node.value), x + w / 2, y + h / 2 + (node.type === "decision" ? 18 : 13));
        }
      }

      if (hasAnimation && isInView) {
        rafId = requestAnimationFrame(render);
      }
    };

    if (hasAnimation && isInView) {
      rafId = requestAnimationFrame(render);
    } else {
      render(performance.now()); // Single render if no animation or not in view
    }
    
    return () => cancelAnimationFrame(rafId);
  }, [layout, isInView, highlightedNodeIds]);

  return (
    <div className="rounded-xl overflow-x-auto border border-slate-700/60 bg-slate-950">
      <canvas ref={ref} className="block mx-auto" />
    </div>
  );
}
