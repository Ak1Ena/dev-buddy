import { useMemo, useRef } from "react";
import { Pin } from "lucide-react";
import type { VizNode, VizEdge } from "@/types";
import { useLessonHighlight, codeRefOverlaps } from "@/store/lessonHighlight";
import { cn } from "@/lib/utils";

interface Props {
  nodes: VizNode[];
  edges: VizEdge[];
}

interface PlacedNode extends VizNode {
  x: number;
  y: number;
}

const NODE_W = 200;
const NODE_H = 72;

function place(nodes: VizNode[], edges: VizEdge[]): PlacedNode[] {
  if (nodes.length === 0) return [];

  const incoming = new Map<string, number>();
  nodes.forEach((n) => incoming.set(n.id, 0));
  edges.forEach((e) => incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1));
  const roots = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0).map((n) => n.id);
  const queue: { id: string; depth: number }[] = roots.map((id) => ({ id, depth: 0 }));
  const depthOf = new Map<string, number>();
  const visited = new Set<string>();
  while (queue.length) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    depthOf.set(id, depth);
    edges.filter((e) => e.source === id).forEach((e) => queue.push({ id: e.target, depth: depth + 1 }));
  }
  nodes.forEach((n) => { if (!depthOf.has(n.id)) depthOf.set(n.id, 0); });

  const byDepth = new Map<number, string[]>();
  depthOf.forEach((d, id) => {
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(id);
  });

  const placed: PlacedNode[] = [];
  const colW = NODE_W + 100;
  const rowH = NODE_H + 64;
  Array.from(byDepth.keys())
    .sort((a, b) => a - b)
    .forEach((d) => {
      const ids = byDepth.get(d)!;
      ids.forEach((id, i) => {
        const node = nodes.find((n) => n.id === id)!;
        placed.push({ ...node, x: d * colW, y: i * rowH - ((ids.length - 1) * rowH) / 2 });
      });
    });
  return placed;
}

export default function ConceptGraph({ nodes, edges }: Props) {
  const placed = useMemo(() => place(nodes, edges), [nodes, edges]);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, SVGGElement>>(new Map());

  const focusNodeAt = (idx: number) => {
    if (placed.length === 0) return;
    const wrapped = ((idx % placed.length) + placed.length) % placed.length;
    nodeRefs.current.get(placed[wrapped].id)?.focus();
  };

  const hoveredNodeId = useLessonHighlight((s) => s.hoveredNodeId);
  const pinnedNodeId = useLessonHighlight((s) => s.pinnedNodeId);
  const hoveredCodeRef = useLessonHighlight((s) => s.hoveredCodeRef);
  const setHovered = useLessonHighlight((s) => s.setHovered);
  const togglePinned = useLessonHighlight((s) => s.togglePinned);

  const bounds = useMemo(() => {
    if (placed.length === 0) return { w: 400, h: 260, minX: 0, minY: 0 };
    const minX = Math.min(...placed.map((n) => n.x));
    const maxX = Math.max(...placed.map((n) => n.x));
    const minY = Math.min(...placed.map((n) => n.y));
    const maxY = Math.max(...placed.map((n) => n.y));
    return { w: maxX - minX + NODE_W + 80, h: maxY - minY + NODE_H + 80, minX: minX - 40, minY: minY - 40 };
  }, [placed]);

  const idToPlaced = useMemo(() => new Map(placed.map((p) => [p.id, p])), [placed]);

  const clearHighlight = useLessonHighlight((s) => s.clear);

  const activeEdges = useMemo(() => {
    const id = pinnedNodeId;
    if (!id) return new Set<number>();
    return new Set(
      edges
        .map((e, i) => (e.source === id || e.target === id ? i : -1))
        .filter((i) => i >= 0)
    );
  }, [edges, pinnedNodeId]);

  return (
    <div 
      ref={containerRef} 
      className="h-full w-full overflow-auto custom-scrollbar bg-slate-950/20"
      onClick={() => clearHighlight()}
    >
      <div className="flex items-center justify-center p-20 min-w-max min-h-full">
        <svg
          width={bounds.w}
          height={bounds.h}
          viewBox={`${bounds.minX} ${bounds.minY} ${bounds.w} ${bounds.h}`}
          className="block shrink-0 drop-shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
        <defs>
          <marker
            id="graph-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(100 116 139)" />
          </marker>
          <marker
            id="graph-arrow-active"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(56 189 248)" />
          </marker>
          <filter id="graph-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {edges.map((e, i) => {
          const a = idToPlaced.get(e.source);
          const b = idToPlaced.get(e.target);
          if (!a || !b) return null;
          const x1 = a.x + NODE_W;
          const y1 = a.y + NODE_H / 2;
          const x2 = b.x;
          const y2 = b.y + NODE_H / 2;
          const mx = (x1 + x2) / 2;
          const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
          const isActive = activeEdges.has(i);
          return (
            <g key={`edge-${i}`}>
              <path
                d={d}
                fill="none"
                stroke={isActive ? "rgb(56 189 248)" : "rgb(71 85 105 / 0.5)"}
                strokeWidth={isActive ? 2.5 : 2}
                markerEnd={isActive ? "url(#graph-arrow-active)" : "url(#graph-arrow)"}
                className="transition-all duration-[120ms]"
              />
              {e.label && (
                <text
                  x={mx}
                  y={(y1 + y2) / 2 - 8}
                  textAnchor="middle"
                  fontSize="11"
                  fill="rgb(148 163 184)"
                  fontWeight="600"
                  className="font-mono tracking-tighter"
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {placed.map((n, ni) => {
          const isPinned = pinnedNodeId === n.id;
          const linked = codeRefOverlaps(hoveredCodeRef, n.code_ref);
          const active = isPinned || linked;
          const aria = [n.label, n.summary, n.code_ref ? `lines ${n.code_ref.line_start}-${n.code_ref.line_end}` : ""]
            .filter(Boolean)
            .join(", ");
          return (
            <g
              key={n.id}
              data-node-id={n.id}
              role="button"
              tabIndex={0}
              aria-label={aria}
              aria-pressed={isPinned}
              ref={(el) => {
                if (el) nodeRefs.current.set(n.id, el);
                else nodeRefs.current.delete(n.id);
              }}
              transform={`translate(${n.x}, ${n.y})`}
              className="group cursor-pointer outline-none transition-all duration-[120ms] ease-out motion-reduce:transition-none"
              onClick={(e) => {
                e.stopPropagation();
                togglePinned(n.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  togglePinned(n.id);
                } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  focusNodeAt(ni + 1);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  focusNodeAt(ni - 1);
                }
              }}
            >
              {/* Keyboard focus ring */}
              <rect
                width={NODE_W + 6}
                height={NODE_H + 6}
                x={-3}
                y={-3}
                rx={18}
                ry={18}
                fill="none"
                stroke="rgb(56 189 248)"
                strokeWidth={3}
                className="opacity-0 group-focus-visible:opacity-100 transition-opacity duration-100"
              />
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={16}
                ry={16}
                className={cn(
                  "transition-all duration-200 shadow-xl",
                  active
                    ? "fill-sky-500/20 stroke-sky-400"
                    : "fill-slate-900/90 stroke-slate-700/80"
                )}
                strokeWidth={active ? 2.5 : 1.5}
                filter={active ? "url(#graph-glow)" : undefined}
              />
              {isPinned && (
                <foreignObject x={NODE_W - 28} y={8} width={20} height={20}>
                  <Pin className="h-4 w-4 text-sky-300 fill-sky-300/20" />
                </foreignObject>
              )}
              <foreignObject x={14} y={10} width={NODE_W - 28} height={NODE_H - 20}>
                <div className="flex h-full flex-col justify-center">
                  <div className={cn("text-[13px] font-bold leading-tight line-clamp-1", active ? "text-white" : "text-slate-100")}>
                    {n.label}
                  </div>
                  {n.summary && (
                    <div className={cn("text-[10px] leading-snug line-clamp-2 mt-1 font-medium", active ? "text-sky-200/80" : "text-slate-400")}>
                      {n.summary}
                    </div>
                  )}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
}
