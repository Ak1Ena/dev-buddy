"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Code2, Loader2, ChevronLeft, MessageSquare,
  BookOpen, Lightbulb, Wrench, Sparkles, ChevronRight,
  CheckCircle2, FlaskConical,
} from "lucide-react";
import toast from "react-hot-toast";
import { learningApi, chatApi } from "@/lib/api";
import type { Lesson, ChatMessage } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CodeVisualizer from "@/components/visualization/CodeVisualizer";
import WorkshopExercise from "@/components/lesson/WorkshopExercise";
import { topicLabel, cn } from "@/lib/utils";

/* ── animation variants ─────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

const chipVariant = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
};

/* ── Section wrapper with scroll-triggered reveal ───────────────────────── */
function Section({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const HINT_LEVELS = [
  { level: 0, label: "Open chat" },
  { level: 1, label: "Concept hint" },
  { level: 2, label: "Direction hint" },
  { level: 3, label: "Guided example" },
];

export default function Learn() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loadingLesson, setLoadingLesson] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | undefined>();
  const [hintLevel, setHintLevel] = useState(0);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeContext, setCodeContext] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const handleContentScroll = useCallback(() => {
    const el = contentScrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const total = scrollHeight - clientHeight;
    setScrollProgress(total > 0 ? Math.min(100, (scrollTop / total) * 100) : 0);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, chatLoading, scrollToBottom]);

  useEffect(() => {
    if (!lessonId) return;
    const fetchLesson = async () => {
      setLoadingLesson(true);
      try {
        const res = await learningApi.getLesson(lessonId);
        setLesson(res.data);
        await learningApi.updateProgress(lessonId, { status: "in_progress" });
      } catch {
        toast.error("Failed to load lesson.");
        navigate("/dashboard");
      } finally {
        setLoadingLesson(false);
      }
    };
    fetchLesson();
  }, [lessonId, navigate]);

  const handleSendMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      metadata: null,
      created_at: new Date().toISOString(),
    };
    setMessages((p) => [...p, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await chatApi.send({
        message: trimmed,
        session_id: chatSessionId,
        lesson_id: lessonId,
        code_context: showCodeInput && codeContext ? codeContext : undefined,
        hint_level: hintLevel,
      });
      const data = res.data;
      if (!chatSessionId && data.session_id) setChatSessionId(data.session_id);
      setMessages((p) => [
        ...p,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response ?? data.message ?? "I'm here to help!",
          metadata: null,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {
      toast.error("Failed to send message.");
      setMessages((p) => p.slice(0, -1));
      setChatInput(trimmed);
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const handleWorkshopComplete = async (score: number) => {
    if (!lessonId) return;
    try {
      await learningApi.updateProgress(lessonId, {
        workshop_score: score,
        status: score > 0 ? "completed" : "in_progress",
      });
      if (score > 0) toast.success(`Workshop complete! Score: ${score}/100`);
    } catch { /* silent */ }
  };

  /* ── Loading ── */
  if (loadingLesson) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          >
            <Sparkles className="h-10 w-10 text-sky-400" />
          </motion.div>
          <p className="text-slate-400 text-sm">Preparing your lesson…</p>
        </div>
      </div>
    );
  }

  if (!lesson) return null;
  const c = lesson.content;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

      {/* ══ LEFT — lesson content ══════════════════════════════════════════ */}
      <div className="flex w-[60%] flex-col border-r border-slate-700/60 overflow-hidden">

        {/* Scroll progress bar */}
        <div className="h-0.5 w-full bg-slate-800 shrink-0">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-500 to-fuchsia-500 origin-left"
            style={{ scaleX: scrollProgress / 100 }}
            transition={{ type: "spring", stiffness: 300, damping: 40 }}
          />
        </div>

        {/* Lesson header */}
        <div className="border-b border-slate-700/60 bg-slate-900/80 px-6 py-4 shrink-0">
          <button
            onClick={() => navigate("/dashboard")}
            className="mb-3 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to lessons
          </button>
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-white leading-tight">{lesson.title}</h1>
              {lesson.description && (
                <p className="mt-1 text-sm text-slate-400 leading-relaxed">{lesson.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="default">{topicLabel(lesson.topic)}</Badge>
              <Badge variant="secondary" className="capitalize">{lesson.difficulty}</Badge>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div
          ref={contentScrollRef}
          onScroll={handleContentScroll}
          className="flex-1 overflow-y-auto"
        >
          {c ? (
            <div className="px-6 py-8 space-y-10">

              {/* Key concepts chips */}
              {c.key_concepts?.length > 0 && (
                <Section delay={0}>
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      What you'll learn
                    </span>
                  </div>
                  <motion.div
                    className="flex flex-wrap gap-2"
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true }}
                  >
                    {c.key_concepts.map((concept: string) => (
                      <motion.span
                        key={concept}
                        variants={chipVariant}
                        className="rounded-full border border-sky-500/25 bg-sky-500/10 px-3.5 py-1.5 text-sm font-medium text-sky-300"
                      >
                        {concept}
                      </motion.span>
                    ))}
                  </motion.div>
                </Section>
              )}

              {/* Main explanation */}
              {c.explanation && (
                <Section delay={0.05}>
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="h-4 w-4 text-sky-400" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Explanation
                    </span>
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none
                    prose-headings:text-slate-100 prose-headings:font-semibold
                    prose-p:text-slate-300 prose-p:leading-7
                    prose-code:text-sky-300 prose-code:bg-slate-800/80 prose-code:rounded prose-code:px-1
                    prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700
                    prose-strong:text-white prose-a:text-sky-400
                    prose-li:text-slate-300 prose-li:leading-7">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {c.explanation}
                    </ReactMarkdown>
                  </div>
                </Section>
              )}

              {/* Code examples */}
              {c.code_examples?.length > 0 && (
                <Section delay={0.05}>
                  <div className="flex items-center gap-2 mb-4">
                    <Code2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Code examples
                    </span>
                  </div>
                  <div className="space-y-6">
                    {c.code_examples.map((ex: { title: string; code: string; explanation: string; language: string }, i: number) => (
                      <motion.div
                        key={i}
                        variants={fadeUp}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, margin: "-40px" }}
                        transition={{ delay: i * 0.08 }}
                        className="rounded-2xl border border-slate-700/60 overflow-hidden"
                      >
                        {/* Code block header */}
                        <div className="flex items-center justify-between border-b border-slate-700/60 bg-slate-900/70 px-4 py-2.5">
                          <span className="text-sm font-medium text-slate-300">{ex.title}</span>
                          <div className="flex gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/50" />
                            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/50" />
                          </div>
                        </div>
                        <Editor
                          height="180px"
                          language={ex.language ?? "python"}
                          value={ex.code}
                          theme="vs-dark"
                          options={{
                            readOnly: true, minimap: { enabled: false },
                            scrollBeyondLastLine: false, fontSize: 13,
                            lineNumbers: "on", renderLineHighlight: "none",
                            contextmenu: false, folding: false, overviewRulerLanes: 0,
                            padding: { top: 10, bottom: 10 },
                          }}
                        />
                        {ex.explanation && (
                          <div className="border-t border-slate-700/60 bg-slate-800/30 px-4 py-3">
                            <p className="text-sm leading-relaxed text-slate-400">{ex.explanation}</p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Visualizer */}
              {c.visualizations?.length > 0 && (
                <Section delay={0.05}>
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-4 w-4 text-fuchsia-400" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Step visualizer
                    </span>
                  </div>
                  <div className="space-y-4">
                    {c.visualizations.map((viz: { title: string; code: string; steps: unknown[] }, i: number) => (
                      <CodeVisualizer key={i} title={viz.title} code={viz.code} steps={viz.steps as never} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Workshop */}
              {c.workshops?.length > 0 && (
                <Section delay={0.05}>
                  <div className="flex items-center gap-2 mb-4">
                    <Wrench className="h-4 w-4 text-orange-400" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Practice exercise
                    </span>
                  </div>
                  <WorkshopExercise workshop={c.workshops[0]} onComplete={handleWorkshopComplete} />
                </Section>
              )}

              {/* Summary */}
              {c.summary && (
                <Section delay={0.05}>
                  <motion.div
                    className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5"
                    whileHover={{ scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500 mb-1">
                        Key takeaway
                      </p>
                      <p className="text-sm leading-relaxed text-slate-300">{c.summary}</p>
                    </div>
                  </motion.div>
                </Section>
              )}

              {/* Next lesson nudge */}
              <Section delay={0.05}>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="group flex w-full items-center justify-between rounded-2xl border border-slate-700/60 bg-slate-800/40 px-5 py-4 transition-all hover:border-sky-500/40 hover:bg-sky-500/5"
                >
                  <span className="text-sm font-medium text-slate-300 group-hover:text-slate-100">
                    Back to your learning path
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-sky-400 transition-colors" />
                </button>
              </Section>

              <div className="h-8" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
                <p className="text-sm text-slate-400">Loading lesson content…</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ RIGHT — AI mentor ══════════════════════════════════════════════ */}
      <div className="flex w-[40%] flex-col bg-slate-900/50 overflow-hidden">

        {/* Chat header */}
        <div className="border-b border-slate-700/60 bg-slate-900/80 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15">
              <MessageSquare className="h-4 w-4 text-sky-400" />
            </div>
            <span className="font-semibold text-white">AI Mentor</span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs text-emerald-400">Ready</span>
            </span>
          </div>

          {/* Hint level pills */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {HINT_LEVELS.map((h) => (
              <motion.button
                key={h.level}
                onClick={() => setHintLevel(h.level)}
                whileTap={{ scale: 0.94 }}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors border",
                  hintLevel === h.level
                    ? "border-sky-500 bg-sky-500/20 text-sky-300"
                    : "border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                )}
              >
                {h.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <AnimatePresence initial={false}>
            {messages.length === 0 && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full gap-3 py-8 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10">
                  <MessageSquare className="h-7 w-7 text-sky-400" />
                </div>
                <p className="font-medium text-slate-300">Ask your AI mentor</p>
                <p className="text-sm text-slate-500 max-w-[220px]">
                  Ask anything about this lesson — I'll guide you, not just give the answer.
                </p>
              </motion.div>
            )}

            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-sky-500 text-white rounded-br-sm"
                      : "bg-slate-700/80 text-slate-200 rounded-bl-sm"
                  )}
                >
                  <div className="prose prose-sm prose-invert max-w-none prose-p:my-0.5 prose-p:text-inherit prose-code:text-sky-300 prose-code:bg-slate-800/80">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {chatLoading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-slate-700/80 px-4 py-3">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-slate-700/60 bg-slate-900/80 p-4 space-y-3 shrink-0">
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCodeInput((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                showCodeInput
                  ? "border-sky-500 bg-sky-500/10 text-sky-400"
                  : "border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300"
              )}
            >
              <Code2 className="h-3.5 w-3.5" />
              Share code
            </motion.button>
          </div>

          <AnimatePresence>
            {showCodeInput && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden rounded-xl border border-slate-700/60"
              >
                <Editor
                  height="110px"
                  language="python"
                  value={codeContext}
                  onChange={(v) => setCodeContext(v ?? "")}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false }, scrollBeyondLastLine: false,
                    fontSize: 12, lineNumbers: "off", folding: false,
                    overviewRulerLanes: 0, padding: { top: 8, bottom: 8 },
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything… (Enter to send)"
              rows={2}
              className="flex-1 resize-none rounded-xl border border-slate-700/60 bg-slate-800/50 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/40"
            />
            <motion.div whileTap={{ scale: 0.92 }} className="self-end">
              <Button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || chatLoading}
                loading={chatLoading}
                size="sm"
                className="h-10 w-10 shrink-0 p-0"
                aria-label="Send"
              >
                {!chatLoading && <Send className="h-4 w-4" />}
              </Button>
            </motion.div>
          </div>

          <p className="text-center text-xs text-slate-700">
            <FlaskConical className="inline h-3 w-3 mr-1" />
            Socratic mode — guided questions, not direct answers
          </p>
        </div>
      </div>
    </div>
  );
}
