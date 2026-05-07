import { useEffect, useRef } from "react";
import type { CanvasSceneData } from "@/types";

const NW = 130;  // node width
const NH = 68;   // node height
const GAP = 56;  // gap between nodes
const PX = 36;   // horizontal padding
const PY = 16;   // top padding (before nodes)
const LABEL_ROW = 20; // extra above PY reserved for edge labels
const CH = LABEL_ROW + PY + NH + PY; // total canvas height

const PAL: Record<string, { bg: string; border: string; val: string; lbl: string }> = {
  sky:     { bg: "rgba(14,165,233,.12)",  border: "#0ea5e9", val: "#38bdf8", lbl: "#7dd3fc" },
  emerald: { bg: "rgba(16,185,129,.12)",  border: "#10b981", val: "#34d399", lbl: "#6ee7b7" },
  fuchsia: { bg: "rgba(168,85,247,.12)",  border: "#a855f7", val: "#c084fc", lbl: "#d8b4fe" },
  amber:   { bg: "rgba(245,158,11,.12)",  border: "#f59e0b", val: "#fbbf24", lbl: "#fde68a" },
  red:     { bg: "rgba(239,68,68,.12)",   border: "#ef4444", val: "#f87171", lbl: "#fca5a5" },
  slate:   { bg: "rgba(71,85,105,.15)",   border: "#475569", val: "#94a3b8", lbl: "#cbd5e1" },
};

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export default function CanvasScene({ scene }: { scene: CanvasSceneData }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { nodes, edges = [] } = scene;
    const n = nodes.length;
    if (!n) return;

    const CW = Math.max(320, PX * 2 + n * NW + Math.max(0, n - 1) * GAP);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = CW * dpr;
    canvas.height = CH * dpr;
    canvas.style.width = `${CW}px`;
    canvas.style.height = `${CH}px`;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, CW, CH);

    const nx = (i: number) => PX + i * (NW + GAP);
    const ny = LABEL_ROW + PY;

    // ── Edges ──────────────────────────────────────────────────────────────
    edges.forEach((edge) => {
      const fi = nodes.findIndex(nd => nd.id === edge.from);
      const ti = nodes.findIndex(nd => nd.id === edge.to);
      if (fi < 0 || ti < 0) return;

      const x1 = nx(fi) + NW;
      const y1 = ny + NH / 2;
      const x2 = nx(ti);
      const y2 = ny + NH / 2;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const TIP = 9;
      const col = (PAL[nodes[fi].color ?? "sky"] ?? PAL.sky).border;

      // Line
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(edge.style === "dashed" ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2 - TIP * Math.cos(angle), y2 - TIP * Math.sin(angle));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Arrowhead
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - TIP * Math.cos(angle - Math.PI / 6), y2 - TIP * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - TIP * Math.cos(angle + Math.PI / 6), y2 - TIP * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      // Edge label above midpoint
      if (edge.label) {
        ctx.fillStyle = "#64748b";
        ctx.font = "600 10px ui-monospace, SFMono-Regular, monospace";
        ctx.textAlign = "center";
        ctx.fillText(edge.label, (x1 + x2) / 2, ny - 8);
      }
    });

    // ── Nodes ──────────────────────────────────────────────────────────────
    nodes.forEach((node, i) => {
      const x = nx(i);
      const y = ny;
      const p = PAL[node.color ?? "sky"] ?? PAL.sky;

      // Glow behind highlighted node
      if (node.highlight) {
        ctx.save();
        ctx.shadowColor = p.border;
        ctx.shadowBlur = 22;
        ctx.strokeStyle = p.border;
        ctx.lineWidth = 2;
        rr(ctx, x - 3, y - 3, NW + 6, NH + 6, 13);
        ctx.stroke();
        ctx.restore();
      }

      // Fill
      ctx.fillStyle = p.bg;
      rr(ctx, x, y, NW, NH, 10);
      ctx.fill();

      // Border
      ctx.strokeStyle = p.border;
      ctx.lineWidth = node.highlight ? 2 : 1;
      rr(ctx, x, y, NW, NH, 10);
      ctx.stroke();

      // Variable name (label row)
      ctx.fillStyle = p.lbl;
      ctx.font = "600 9px ui-monospace, SFMono-Regular, monospace";
      ctx.textAlign = "center";
      ctx.fillText(node.label, x + NW / 2, y + 15);

      // Divider
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = p.border;
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 25);
      ctx.lineTo(x + NW - 10, y + 25);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Value (centred in lower portion)
      if (node.value != null && node.value !== "") {
        ctx.fillStyle = p.val;
        ctx.font = "bold 17px ui-monospace, SFMono-Regular, monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(node.value), x + NW / 2, y + NH / 2 + 13);
      }
    });
  }, [scene]);

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/60">
      <canvas ref={ref} className="block max-w-full" />
    </div>
  );
}
