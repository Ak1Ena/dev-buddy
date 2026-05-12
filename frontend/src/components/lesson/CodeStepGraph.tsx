import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface WalkthroughItem {
  code: string;
  plain_english: string;
  why: string;
}

interface Props {
  items: WalkthroughItem[];
  activeIndex: number;
  onActiveIndexChange: (i: number) => void;
}

interface Token { text: string; cls: string }

const KW_RE = /\b(def|return|for|if|elif|else|while|class|import|from|in|not|and|or|True|False|None|pass|break|continue|yield|lambda|with|as|try|except|finally|raise|is|del|global|nonlocal|assert|async|await)\b/;

function tokenize(line: string): Token[] {
  if (!line.trim()) return [{ text: line || " ", cls: "text-slate-500" }];
  const tokens: Token[] = [];
  const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|#.*$|\b\d+\.?\d*\b|\b(?:def|return|for|if|elif|else|while|class|import|from|in|not|and|or|True|False|None|pass|break|continue|yield|lambda|with|as|try|except|finally|raise|is|del|global|nonlocal|assert|async|await)\b)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) tokens.push({ text: line.slice(last, m.index), cls: "text-slate-300" });
    const tok = m[0];
    if (tok.startsWith("#")) { tokens.push({ text: tok, cls: "text-slate-600" }); last = line.length; break; }
    else if (tok.startsWith('"') || tok.startsWith("'")) tokens.push({ text: tok, cls: "text-amber-300" });
    else if (/^\d/.test(tok)) tokens.push({ text: tok, cls: "text-emerald-300" });
    else if (KW_RE.test(tok)) tokens.push({ text: tok, cls: "text-fuchsia-300" });
    else tokens.push({ text: tok, cls: "text-slate-300" });
    last = m.index + tok.length;
  }
  if (last < line.length) tokens.push({ text: line.slice(last), cls: "text-slate-300" });
  return tokens;
}

const MAX_LINES = 6;

export default function CodeStepGraph({ items, activeIndex, onActiveIndexChange }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const target = activeRef.current;
    const tTop = target.offsetTop;
    const tBottom = tTop + target.offsetHeight;
    const cTop = container.scrollTop;
    const cBottom = cTop + container.clientHeight;
    if (tTop < cTop + 32 || tBottom > cBottom - 32) {
      container.scrollTo({ top: Math.max(0, tTop - 48), behavior: "smooth" });
    }
  }, [activeIndex]);

  return (
    <div ref={containerRef} className="overflow-y-auto px-2.5 py-2.5" style={{ maxHeight: "100%" }}>
      {items.map((item, i) => {
        const isActive = i === activeIndex;
        const isPast = i < activeIndex;
        const allLines = item.code.split("\n");
        const preview = allLines.slice(0, MAX_LINES);
        const overflow = allLines.length - MAX_LINES;

        return (
          <div key={i} className="flex flex-col items-center">
            {/* ── Node ── */}
            <motion.button
              ref={isActive ? activeRef : undefined}
              onClick={() => onActiveIndexChange(i)}
              whileTap={{ scale: 0.985 }}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "w-full rounded-xl text-left overflow-hidden transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
                isActive
                  ? "bg-sky-500/[0.06] shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]"
                  : isPast
                  ? "bg-emerald-500/[0.03] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.10)] hover:bg-emerald-500/[0.06]"
                  : "bg-slate-900/40 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.06)] hover:bg-slate-800/40"
              )}
            >
              <div className="flex items-stretch">
                {/* Left rail — sole state indicator */}
                <div
                  aria-hidden
                  className={cn(
                    "shrink-0 w-[3px] rounded-l-xl transition-colors duration-150",
                    isActive ? "bg-sky-500" : isPast ? "bg-emerald-500/60" : "bg-slate-800"
                  )}
                />

                {/* Code surface */}
                <div className="flex-1 mx-2 my-2 rounded-lg overflow-hidden bg-slate-950 ring-1 ring-slate-800/60"
                  style={{ ...(isActive ? { boxShadow: "inset 0 0 0 1px rgba(56,189,248,0.2)" } : {}) }}
                >
                  {/* Step number — styled like a line-number, not a badge */}
                  <div className={cn(
                    "px-3 pt-1.5 pb-0.5 font-mono text-[10px] tabular-nums select-none",
                    isActive ? "text-sky-500/70" : isPast ? "text-emerald-500/50" : "text-slate-600"
                  )}>
                    step {i + 1}
                  </div>

                  {/* Code lines */}
                  <pre
                    aria-label={`Step ${i + 1} code preview`}
                    className={cn(
                      "px-3 pb-2.5 font-mono text-[12.5px] leading-[1.7] whitespace-pre overflow-x-auto",
                      !isActive && (isPast ? "opacity-50" : "opacity-35")
                    )}
                  >
                    {preview.map((line, li) => (
                      <div key={li}>
                        {tokenize(line).map((tok, ti) => (
                          <span key={ti} className={tok.cls}>{tok.text}</span>
                        ))}
                      </div>
                    ))}
                  </pre>

                  {overflow > 0 && (
                    <div
                      className="px-3 pb-2 font-mono text-[11px] text-slate-700"
                      aria-label={`${overflow} more lines not shown`}
                    >
                      +{overflow} line{overflow > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>
            </motion.button>

            {/* ── Connector: line · dot · line ── */}
            {i < items.length - 1 && (
              <div className="flex flex-col items-center w-full py-0.5" aria-hidden>
                <div className={cn("w-px", i < activeIndex ? "bg-emerald-500/30" : "bg-slate-800")} style={{ height: 7 }} />
                <div className={cn("h-[5px] w-[5px] rounded-full shrink-0", i < activeIndex ? "bg-emerald-500/40" : "bg-slate-700")} />
                <div className={cn("w-px", i < activeIndex ? "bg-emerald-500/30" : "bg-slate-800")} style={{ height: 7 }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
