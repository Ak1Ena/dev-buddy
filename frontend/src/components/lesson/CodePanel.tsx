import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import type { Viz, CodeRef, VizNode } from "@/types";
import { useLessonHighlight, codeRefOverlaps } from "@/store/lessonHighlight";
import { cn } from "@/lib/utils";

interface WalkthroughItem {
  code: string;
  plain_english: string;
  why: string;
}

interface Props {
  items: WalkthroughItem[];
  viz?: Viz;
  activeIndex: number;
  onActiveIndexChange: (i: number) => void;
}

interface Token {
  text: string;
  cls: string;
}

const KEYWORD_RE = /\b(def|return|for|if|elif|else|while|class|import|from|in|not|and|or|True|False|None|pass|break|continue|yield|lambda|with|as|try|except|finally|raise|is|del|global|nonlocal|assert|async|await)\b/;

function tokenize(line: string): Token[] {
  if (!line) return [{ text: " ", cls: "text-slate-200" }];

  const tokens: Token[] = [];
  // Match: strings > comments > numbers > keywords, in priority order
  const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|#.*$|\b\d+\.?\d*\b|\b(def|return|for|if|elif|else|while|class|import|from|in|not|and|or|True|False|None|pass|break|continue|yield|lambda|with|as|try|except|finally|raise|is|del|global|nonlocal|assert|async|await)\b)/g;

  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(line)) !== null) {
    if (m.index > last) {
      tokens.push({ text: line.slice(last, m.index), cls: "text-slate-200" });
    }
    const tok = m[0];
    if (tok.startsWith("#")) {
      tokens.push({ text: tok, cls: "text-slate-500" });
      last = line.length;
      break;
    } else if (tok.startsWith('"') || tok.startsWith("'")) {
      tokens.push({ text: tok, cls: "text-amber-300" });
    } else if (/^\d/.test(tok)) {
      tokens.push({ text: tok, cls: "text-emerald-300" });
    } else if (KEYWORD_RE.test(tok)) {
      tokens.push({ text: tok, cls: "text-fuchsia-300" });
    } else {
      tokens.push({ text: tok, cls: "text-slate-200" });
    }
    last = m.index + tok.length;
  }

  if (last < line.length) {
    tokens.push({ text: line.slice(last), cls: "text-slate-200" });
  }
  return tokens;
}

function useActiveCodeRef(viz: Viz | undefined): CodeRef | null {
  const hoveredNodeId = useLessonHighlight((s) => s.hoveredNodeId);
  const pinnedNodeId = useLessonHighlight((s) => s.pinnedNodeId);

  return useMemo(() => {
    if (!viz) return null;
    const id = pinnedNodeId ?? hoveredNodeId;
    if (!id) return null;
    let nodes: VizNode[] = [];
    if (viz.kind === "tree") nodes = viz.nodes;
    else if (viz.kind === "graph") nodes = viz.nodes;
    else if (viz.kind === "flow") nodes = viz.steps;
    else return null;
    return nodes.find((n) => n.id === id)?.code_ref ?? null;
  }, [viz, hoveredNodeId, pinnedNodeId]);
}

export default function CodePanel({ items, viz, activeIndex, onActiveIndexChange }: Props) {
  const activeCodeRef = useActiveCodeRef(viz);
  const setHoveredCode = useLessonHighlight((s) => s.setHoveredCode);
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const firstHighlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      activeCodeRef &&
      activeCodeRef.walkthrough_index >= 0 &&
      activeCodeRef.walkthrough_index < items.length &&
      activeCodeRef.walkthrough_index !== activeIndex
    ) {
      onActiveIndexChange(activeCodeRef.walkthrough_index);
    }
  }, [activeCodeRef, activeIndex, items.length, onActiveIndexChange]);

  useEffect(() => {
    if (!firstHighlightRef.current || !codeContainerRef.current) return;
    const panel = codeContainerRef.current;
    const target = firstHighlightRef.current;
    const tTop = target.offsetTop;
    const tBottom = tTop + target.offsetHeight;
    const pTop = panel.scrollTop;
    const pBottom = pTop + panel.clientHeight;
    if (tTop < pTop || tBottom > pBottom) {
      panel.scrollTo({ top: Math.max(0, tTop - 60), behavior: "smooth" });
    }
  }, [activeCodeRef, activeIndex]);

  const item = items[activeIndex];
  if (!item) return null;
  const lines = item.code.split("\n");

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/50 bg-slate-900/80 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Code
          </span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500 tabular-nums">
            Block {activeIndex + 1} / {items.length}
          </span>
        </div>
        {/* Dot nav with proper touch targets */}
        <div className="flex items-center">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => onActiveIndexChange(i)}
              className="flex items-center justify-center p-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              aria-label={`Go to code block ${i + 1}`}
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-all",
                  i === activeIndex ? "w-6 bg-sky-400" : "w-4 bg-slate-700 hover:bg-slate-500"
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Code body with per-line highlight and syntax coloring */}
      <div
        ref={codeContainerRef}
        className="flex-1 overflow-y-auto bg-slate-950 font-mono text-sm leading-6"
      >
        {lines.map((line, i) => {
          const lineNo = i + 1;
          const ref: CodeRef = {
            walkthrough_index: activeIndex,
            line_start: lineNo,
            line_end: lineNo,
          };
          const inHighlight = codeRefOverlaps(activeCodeRef, ref);
          const isFirstHighlightLine =
            inHighlight &&
            activeCodeRef?.walkthrough_index === activeIndex &&
            activeCodeRef?.line_start === lineNo;
          return (
            <div
              key={i}
              ref={isFirstHighlightLine ? firstHighlightRef : undefined}
              onMouseEnter={() => setHoveredCode(ref)}
              onMouseLeave={() => setHoveredCode(null)}
              aria-current={inHighlight ? true : undefined}
              className={cn(
                "group relative flex items-start gap-3 pr-4 transition-all duration-[180ms] ease-out motion-reduce:transition-none",
                inHighlight ? "bg-sky-500/[0.08]" : "hover:bg-slate-900/60"
              )}
            >
              <div
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-[3px] transition-all duration-[180ms] motion-reduce:transition-none",
                  inHighlight ? "bg-sky-400" : "bg-transparent"
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "select-none w-10 shrink-0 pl-3 text-right tabular-nums text-[11px] leading-6",
                  inHighlight ? "text-sky-400" : "text-slate-700"
                )}
              >
                {lineNo}
              </span>
              <pre className="flex-1 whitespace-pre-wrap break-words py-0">
                {tokenize(line).map((tok, ti) => (
                  <span key={ti} className={tok.cls}>{tok.text}</span>
                ))}
              </pre>
            </div>
          );
        })}
      </div>

      {/* Description footer */}
      <div className="shrink-0 border-t border-slate-700/50 bg-slate-900/40 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
          What it does
        </p>
        <p className="text-sm leading-relaxed text-slate-200">
          {item.plain_english}
        </p>
        {item.why && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 flex gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5"
          >
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <p className="text-xs leading-relaxed text-slate-400">{item.why}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
