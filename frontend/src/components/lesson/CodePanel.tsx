import { useEffect, useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";
import type { CodeRef } from "@/types";
import { useLessonHighlight } from "@/store/lessonHighlight";

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

export default function CodePanel({ items, activeIndex, onActiveIndexChange }: Props) {
  const activeCodeRef = useLessonHighlight((s) => s.hoveredCodeRef);
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const [isEditorReady, setIsEditorReady] = useState(false);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
    setIsEditorReady(true);
  };

  useEffect(() => {
    if (!editorRef.current || !isEditorReady) return;

    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    // Apply decorations for highlighting
    let newDecorations: any[] = [];
    if (activeCodeRef && activeCodeRef.walkthrough_index === activeIndex) {
      newDecorations.push({
        range: {
          startLineNumber: activeCodeRef.line_start,
          startColumn: 1,
          endLineNumber: activeCodeRef.line_end,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: "monaco-line-highlight",
          linesDecorationsClassName: "monaco-line-decoration",
        },
      });

      // Scroll to the highlighted line
      editor.revealLineInCenterIfOutsideViewport(activeCodeRef.line_start);
    }

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      newDecorations
    );
  }, [activeCodeRef, activeIndex, isEditorReady]);

  const item = items[activeIndex];
  if (!item) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-[#1e1e1e]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/50 bg-[#252526] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Code
          </span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500 tabular-nums">
            Block {activeIndex + 1} / {items.length}
          </span>
        </div>
        <div className="flex items-center">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => onActiveIndexChange(i)}
              className="flex items-center justify-center p-2 rounded focus-visible:outline-none"
              aria-label={`Go to code block ${i + 1}`}
            >
              <span
                className={`block h-1.5 rounded-full transition-all ${
                  i === activeIndex ? "w-6 bg-sky-400" : "w-4 bg-slate-700 hover:bg-slate-500"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden relative">
        <Editor
          height="100%"
          defaultLanguage="python"
          theme="vs-dark"
          value={item.code}
          onMount={handleEditorDidMount}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16, bottom: 16 },
            fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
            fontLigatures: true,
            scrollbar: {
              vertical: 'visible',
              horizontal: 'hidden'
            }
          }}
        />
        <style dangerouslySetInnerHTML={{ __html: `
          .monaco-line-highlight {
            background-color: rgba(56, 189, 248, 0.15) !important;
          }
          .monaco-line-decoration {
            background-color: #38bdf8;
            width: 3px !important;
            margin-left: 5px;
          }
        `}} />
      </div>

      {/* Description footer */}
      <div className="shrink-0 border-t border-slate-700/50 bg-[#252526] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
          What it does
        </p>
        <p className="text-sm leading-relaxed text-slate-200">
          {item.plain_english}
        </p>
        <AnimatePresence>
          {item.why && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 overflow-hidden"
            >
              <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <p className="text-xs leading-relaxed text-slate-400">{item.why}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
