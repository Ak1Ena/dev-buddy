import { useMemo, useRef, useCallback, useState } from "react";
import { Pin } from "lucide-react";
import type { VizNode } from "@/types";
import {
  useLessonHighlight,
  codeRefOverlaps,
} from "@/store/lessonHighlight";
import { cn } from "@/lib/utils";

interface Props {
  rootId: string;
  nodes: VizNode[];
}

interface LaidOutNode extends VizNode {
  x: number;
  y: number;
  parentId: string | null;
  depth: number;
}

const NODE_W = 168;
const NODE_H = 60;
const HSPACE = 24;
const VSPACE = 88;

function layout(rootId: string, nodes: VizNode[]): LaidOutNode[] {
  const map = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, LaidOutNode>();
  let cursor = 0;

  function walk(id: string, parentId: string | null, depth: number): number {
    const node = map.get(id);
    if (!node) return cursor;
    const kids = (node.children ?? []).filter((c) => map.has(c));
    let x: number;
    if (kids.length === 0) {
      x = cursor * (NODE_W + HSPACE);
      cursor += 1;
    } else {
      const childXs = kids.map((cid) => walk(cid, id, depth + 1));
      x = (childXs[0] + childXs[childXs.length - 1]) / 2;
    }
    out.set(id, { ...node, x, y: depth * VSPACE, parentId, depth });
    return x;
  }

  walk(rootId, null, 0);
  return Array.from(out.values());
}

export default function ConceptTree({ rootId, nodes }: Props) {
  const laid = useMemo(() => layout(rootId, nodes), [rootId, nodes]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedId, setFocusedId] = useState<string | null>(rootId);

  const hoveredNodeId = useLessonHighlight((s) => s.hoveredNodeId);
  const pinnedNodeId = useLessonHighlight((s) => s.pinnedNodeId);
  const hoveredCodeRef = useLessonHighlight((s) => s.hoveredCodeRef);
  const setHovered = useLessonHighlight((s) => s.setHovered);
  const togglePinned = useLessonHighlight((s) => s.togglePinned);

  const bounds = useMemo(() => {
    if (laid.length === 0) return { w: 400, h: 200, minX: 0 };
    const minX = Math.min(...laid.map((n) => n.x));
    const maxX = Math.max(...laid.map((n) => n.x));
    const maxY = Math.max(...laid.map((n) => n.y));
    return { w: maxX - minX + NODE_W + 40, h: maxY + NODE_H + 40, minX: minX - 20 };
  }, [laid]);

  const moveFocus = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      if (!focusedId) return;
      const cur = laid.find((n) => n.id === focusedId);
      if (!cur) return;
      let target: LaidOutNode | undefined;
      if (dir === "down") {
        const kids = laid.filter((n) => n.parentId === cur.id);
        target = kids.sort((a, b) => Math.abs(a.x - cur.x) - Math.abs(b.x - cur.x))[0];
      } else if (dir === "up") {
        target = laid.find((n) => n.id === cur.parentId);
      } else {
        const siblings = laid.filter((n) => n.parentId === cur.parentId);
        siblings.sort((a, b) => a.x - b.x);
        const idx = siblings.findIndex((n) => n.id === cur.id);
        const next = dir === "left" ? idx - 1 : idx + 1;
        target = siblings[next];
      }
      if (target) {
        setFocusedId(target.id);
        containerRef.current?.querySelector<HTMLElement>(`[data-node-id="${target.id}"]`)?.focus();
      }
    },
    [focusedId, laid]
  );

  // Single-node fallback — hooks are above this so Rules of Hooks are respected
  if (nodes.length === 1) {
    const node = nodes[0];
    return (
      <div className="flex items-center justify-center p-6">
        <div className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-6 text-center max-w-sm">
          <div className="text-sm font-semibold text-fuchsia-300 mb-2">{node.label}</div>
          {node.summary && (
            <div className="text-xs text-slate-400 leading-relaxed">{node.summary}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full overflow-auto">
      <svg
        width={bounds.w}
        height={bounds.h}
        viewBox={`${bounds.minX} -20 ${bounds.w} ${bounds.h}`}
        className="block"
      >
        {/* Edges */}
        {laid.map((n) =>
          n.parentId ? (
            <Edge key={`e-${n.parentId}-${n.id}`} parent={laid.find((p) => p.id === n.parentId)!} child={n} />
          ) : null
        )}
        {/* Nodes */}
        {laid.map((n) => {
          const isHovered = hoveredNodeId === n.id;
          const isPinned = pinnedNodeId === n.id;
          const isLinkedByCode = codeRefOverlaps(hoveredCodeRef, n.code_ref);
          const isActive = isHovered || isPinned || isLinkedByCode;
          const isRoot = n.id === rootId;

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
              transform={`translate(${n.x}, ${n.y + (isActive ? -2 : 0)})`}
              className="group cursor-pointer outline-none transition-transform duration-[120ms] ease-out motion-reduce:transition-none"
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setFocusedId(n.id)}
              onBlur={() => { if (focusedId === n.id) setFocusedId(null); }}
              onClick={() => togglePinned(n.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  togglePinned(n.id);
                } else if (e.key === "ArrowUp") { e.preventDefault(); moveFocus("up"); }
                else if (e.key === "ArrowDown") { e.preventDefault(); moveFocus("down"); }
                else if (e.key === "ArrowLeft") { e.preventDefault(); moveFocus("left"); }
                else if (e.key === "ArrowRight") { e.preventDefault(); moveFocus("right"); }
              }}
            >
              {/* Keyboard focus ring — visible via group-focus-visible */}
              <rect
                width={NODE_W + 4}
                height={NODE_H + 4}
                x={-2}
                y={-2}
                rx={14}
                ry={14}
                fill="none"
                stroke="rgb(56 189 248)"
                strokeWidth={2}
                className="opacity-0 group-focus-visible:opacity-100 transition-opacity duration-100"
              />
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={12}
                ry={12}
                fill={
                  isActive
                    ? "rgba(14,165,233,0.15)"
                    : isRoot
                    ? "rgba(232,121,249,0.10)"
                    : "rgba(15,23,42,0.70)"
                }
                stroke={
                  isActive
                    ? "rgb(56,189,248)"
                    : isRoot
                    ? "rgba(232,121,249,0.60)"
                    : "rgba(51,65,85,0.60)"
                }
                strokeWidth={isActive || isRoot ? 2 : 1}
                filter={(isActive || isRoot) ? "url(#tree-glow)" : undefined}
                className="transition-all duration-150"
              />
              {isPinned && (
                <foreignObject x={NODE_W - 22} y={6} width={16} height={16}>
                  <Pin className="h-3.5 w-3.5 text-sky-300" />
                </foreignObject>
              )}
              <foreignObject x={10} y={8} width={NODE_W - 20} height={NODE_H - 16}>
                <div className="flex h-full flex-col justify-center">
                  <div className={cn(
                    "text-sm font-semibold leading-tight truncate",
                    isActive ? "text-sky-200" : isRoot ? "text-fuchsia-200" : "text-slate-200"
                  )}>
                    {n.label}
                  </div>
                  {n.summary && (
                    <div className="text-[10px] text-slate-400 leading-snug line-clamp-2 mt-0.5">
                      {n.summary}
                    </div>
                  )}
                </div>
              </foreignObject>
            </g>
          );
        })}
        <defs>
          <filter id="tree-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
    </div>
  );
}

function Edge({ parent, child }: { parent: LaidOutNode; child: LaidOutNode }) {
  const x1 = parent.x + NODE_W / 2;
  const y1 = parent.y + NODE_H;
  const x2 = child.x + NODE_W / 2;
  const y2 = child.y;
  const my = (y1 + y2) / 2;
  const d = `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
  return <path d={d} fill="none" stroke="rgb(71 85 105 / 0.6)" strokeWidth={1.5} />;
}
