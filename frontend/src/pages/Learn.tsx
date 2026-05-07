"use client";
import { useState, useEffect, useRef, useCallback, RefObject } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Code2, Loader2, ChevronLeft, MessageSquare,
  BookOpen, Lightbulb, Wrench, Sparkles, ChevronRight,
  CheckCircle2, Zap, Info, Star, PlayCircle, List,
} from "lucide-react";
import toast from "react-hot-toast";
import { learningApi, chatApi } from "@/lib/api";
import type { Lesson, ChatMessage } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CodeVisualizer from "@/components/visualization/CodeVisualizer";
import WorkshopExercise from "@/components/lesson/WorkshopExercise";
import AnimationPlayer from "@/components/lesson/AnimationPlayer";
import { topicLabel, cn } from "@/lib/utils";

/* ── animation presets ───────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const chipVariant = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: "easeOut" } },
};

/* ── Section wrapper (scroll-triggered reveal) ───────────────────────────── */
function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      id={id}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Callout box ─────────────────────────────────────────────────────────── */
type CalloutType = "info" | "tip" | "important" | "insight";
const CALLOUT_STYLES: Record<CalloutType, { border: string; bg: string; icon: React.ReactNode; titleColor: string }> = {
  info:      { border: "border-sky-500/30",     bg: "bg-sky-500/5",     icon: <Info className="h-4 w-4" />,      titleColor: "text-sky-400"     },
  tip:       { border: "border-amber-500/30",   bg: "bg-amber-500/5",   icon: <Lightbulb className="h-4 w-4" />, titleColor: "text-amber-400"   },
  important: { border: "border-fuchsia-500/30", bg: "bg-fuchsia-500/5", icon: <Star className="h-4 w-4" />,      titleColor: "text-fuchsia-400" },
  insight:   { border: "border-emerald-500/30", bg: "bg-emerald-500/5", icon: <Zap className="h-4 w-4" />,       titleColor: "text-emerald-400" },
};
function Callout({
  type = "info",
  title,
  children,
}: {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}) {
  const s = CALLOUT_STYLES[type];
  return (
    <div className={cn("flex gap-3 rounded-xl border px-4 py-3.5", s.border, s.bg)}>
      <span className={cn("shrink-0 mt-0.5", s.titleColor)}>{s.icon}</span>
      <div className="min-w-0">
        {title && (
          <p className={cn("mb-1 text-xs font-semibold uppercase tracking-wider", s.titleColor)}>
            {title}
          </p>
        )}
        <div className="text-sm leading-relaxed text-slate-300">{children}</div>
      </div>
    </div>
  );
}

/* ── Section quick-nav ───────────────────────────────────────────────────── */
interface NavItem { id: string; label: string; icon: React.ReactNode }
function SectionNav({
  items,
  scrollRef,
}: {
  items: NavItem[];
  scrollRef: RefObject<HTMLDivElement>;
}) {
  const scrollTo = (id: string) => {
    const target = scrollRef.current?.querySelector(`#${id}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="flex gap-1.5 overflow-x-auto px-6 py-2.5 border-b border-slate-700/40 shrink-0 scrollbar-none">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => scrollTo(item.id)}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-700/60 px-3 py-1 text-xs font-medium text-slate-500 transition-all hover:border-sky-500/40 hover:bg-sky-500/5 hover:text-sky-300"
        >
          <span className="h-3 w-3 shrink-0">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ── Section heading ─────────────────────────────────────────────────────── */
function SectionHeading({
  icon,
  label,
  iconClass,
}: {
  icon: React.ReactNode;
  label: string;
  iconClass?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className={cn("h-4 w-4", iconClass)}>{icon}</span>
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </span>
    </div>
  );
}

/* ── Hint level config ───────────────────────────────────────────────────── */
const HINT_LEVELS = [
  { level: 0, label: "Guide me",     desc: "Socratic questions" },
  { level: 1, label: "Concept hint", desc: "Remind of the concept" },
  { level: 2, label: "Show where",   desc: "Point at the problem" },
  { level: 3, label: "Full example", desc: "Worked example" },
];

/* ════════════════════════════════════════════════════════════════════════════
   Main component
   ══════════════════════════════════════════════════════════════════════════ */
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
    (async () => {
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
    })();
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
          content: data.response ?? data.message?.content ?? "I'm here to help!",
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
            <Loader2 className="h-8 w-8 text-sky-400" />
          </motion.div>
          <p className="text-slate-400 text-sm">Preparing your lesson…</p>
        </div>
      </div>
    );
  }

  if (!lesson) return null;
  const c = lesson.content;

  const isNewFormat = !!(c?.animation_frames || c?.concept_hook);

  /* Build section nav items only for sections that exist */
  const navItems: NavItem[] = [];
  if (c?.key_concepts?.length)       navItems.push({ id: "sec-concepts",   label: "Concepts",   icon: <Lightbulb /> });
  if (isNewFormat && c?.concept_hook) navItems.push({ id: "sec-hook",      label: "Overview",   icon: <Zap /> });
  if (isNewFormat && c?.animation_frames?.length) navItems.push({ id: "sec-animation", label: "Animation", icon: <PlayCircle /> });
  if (isNewFormat && c?.code_walkthrough?.length) navItems.push({ id: "sec-walkthrough", label: "Walkthrough", icon: <List /> });
  if (!isNewFormat && c?.explanation) navItems.push({ id: "sec-explanation", label: "Explanation", icon: <BookOpen /> });
  if (!isNewFormat && c?.code_examples?.length)  navItems.push({ id: "sec-examples", label: "Examples", icon: <Code2 /> });
  if (!isNewFormat && c?.visualizations?.length) navItems.push({ id: "sec-visualizer", label: "Visualizer", icon: <PlayCircle /> });
  if (c?.workshops?.length)          navItems.push({ id: "sec-practice",   label: "Practice",   icon: <Wrench /> });
  if (c?.summary)                    navItems.push({ id: "sec-summary",    label: "Summary",    icon: <CheckCircle2 /> });

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

      {/* ══ LEFT — lesson content ══════════════════════════════════════════ */}
      <div className="flex w-[58%] flex-col border-r border-slate-700/50 overflow-hidden">

        {/* Scroll progress bar */}
        <div className="h-0.5 w-full bg-slate-800 shrink-0">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-500 via-fuchsia-500 to-emerald-500 origin-left"
            style={{ scaleX: scrollProgress / 100 }}
            transition={{ type: "spring", stiffness: 400, damping: 45 }}
          />
        </div>

        {/* Lesson header */}
        <div className="border-b border-slate-700/50 bg-slate-900/90 px-6 py-4 shrink-0">
          <button
            onClick={() => navigate("/dashboard")}
            className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-300 transition-colors"
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
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              <Badge variant="default">{topicLabel(lesson.topic)}</Badge>
              <Badge variant="secondary" className="capitalize">{lesson.difficulty}</Badge>
            </div>
          </div>
        </div>

        {/* Section quick-nav */}
        {c && navItems.length > 0 && (
          <SectionNav items={navItems} scrollRef={contentScrollRef} />
        )}

        {/* Scrollable content */}
        <div
          ref={contentScrollRef}
          onScroll={handleContentScroll}
          className="flex-1 overflow-y-auto"
        >
          {c ? (
            <div className="px-6 py-8 space-y-10">

              {/* ── Key concepts ── */}
              {c.key_concepts && c.key_concepts.length > 0 && (
                <Section id="sec-concepts">
                  <SectionHeading icon={<Lightbulb />} label="What you'll learn" iconClass="text-amber-400" />
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
                        whileHover={{ scale: 1.04, y: -2 }}
                        className="cursor-default rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1.5 text-sm font-medium text-sky-300 transition-shadow hover:shadow-[0_0_12px_rgba(14,165,233,0.2)]"
                      >
                        {concept}
                      </motion.span>
                    ))}
                  </motion.div>
                </Section>
              )}

              {isNewFormat ? (
                <>
                  {/* ── Concept hook ── */}
                  {c.concept_hook && (
                    <Section id="sec-hook">
                      <SectionHeading icon={<Zap />} label="The big idea" iconClass="text-amber-400" />
                      <motion.div
                        className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/8 to-transparent p-5"
                        whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
                      >
                        <div className="absolute inset-0 rounded-2xl pointer-events-none bg-[radial-gradient(ellipse_at_top_left,rgba(245,158,11,0.07),transparent_60%)]" />
                        <p className="text-lg font-medium leading-relaxed text-amber-100">{c.concept_hook}</p>
                      </motion.div>
                    </Section>
                  )}

                  {/* ── Animation player ── */}
                  {c.animation_frames && c.animation_frames.length > 0 && (
                    <Section id="sec-animation">
                      <SectionHeading icon={<PlayCircle />} label="Watch it happen" iconClass="text-fuchsia-400" />
                      <Callout type="tip" title="How to use">
                        Step through each frame to see the code execute one action at a time. Or hit <strong>Auto-play</strong>.
                      </Callout>
                      <div className="mt-4">
                        <AnimationPlayer frames={c.animation_frames} />
                      </div>
                    </Section>
                  )}

                  {/* ── Code walkthrough ── */}
                  {c.code_walkthrough && c.code_walkthrough.length > 0 && (
                    <Section id="sec-walkthrough">
                      <SectionHeading icon={<List />} label="Line by line" iconClass="text-sky-400" />
                      <div className="space-y-4">
                        {c.code_walkthrough.map(
                          (item: { code: string; plain_english: string; why: string }, i: number) => (
                            <motion.div
                              key={i}
                              variants={fadeUp}
                              initial="hidden"
                              whileInView="show"
                              viewport={{ once: true, margin: "-30px" }}
                              transition={{ delay: i * 0.06 }}
                              className="rounded-2xl border border-slate-700/60 overflow-hidden"
                            >
                              {/* code */}
                              <pre className="overflow-x-auto bg-slate-950 px-5 py-3.5 font-mono text-sm leading-6 text-sky-300">
                                {item.code}
                              </pre>
                              <div className="border-t border-slate-700/50 bg-slate-900/40 divide-y divide-slate-700/40">
                                <div className="px-4 py-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                                    What it does
                                  </p>
                                  <p className="text-sm leading-relaxed text-slate-300">{item.plain_english}</p>
                                </div>
                                {item.why && (
                                  <div className="flex gap-2.5 px-4 py-3">
                                    <Zap className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 mb-1">
                                        Why
                                      </p>
                                      <p className="text-sm leading-relaxed text-slate-400">{item.why}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )
                        )}
                      </div>
                    </Section>
                  )}
                </>
              ) : (
                <>
                  {/* ── Legacy: plain explanation ── */}
                  {c.explanation && (
                    <Section id="sec-explanation">
                      <SectionHeading icon={<BookOpen />} label="Explanation" iconClass="text-sky-400" />
                      {c.summary && (
                        <Callout type="insight" title="Key insight">{c.summary}</Callout>
                      )}
                      <div className="mt-4">
                        {c.explanation.split(/\n\n+/).map((para: string, i: number) => (
                          <div
                            key={i}
                            className={cn(
                              "mb-4 leading-7",
                              i === 0
                                ? "text-base font-medium text-slate-200 border-l-2 border-sky-500/50 pl-4 py-0.5"
                                : "text-sm text-slate-300"
                            )}
                          >
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code: ({ children }) => (
                                  <code className="rounded bg-slate-800 px-1 py-0.5 text-sky-300 font-mono text-[0.85em]">{children}</code>
                                ),
                                strong: ({ children }) => (
                                  <strong className="font-semibold text-white">{children}</strong>
                                ),
                              }}
                            >
                              {para}
                            </ReactMarkdown>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* ── Legacy: code examples ── */}
                  {c.code_examples && c.code_examples.length > 0 && (
                    <Section id="sec-examples">
                      <SectionHeading icon={<Code2 />} label="Code examples" iconClass="text-emerald-400" />
                      <div className="space-y-5">
                        {c.code_examples.map(
                          (ex: { title: string; code: string; explanation: string; language: string }, i: number) => (
                            <motion.div
                              key={i}
                              variants={fadeUp}
                              initial="hidden"
                              whileInView="show"
                              viewport={{ once: true, margin: "-40px" }}
                              whileHover={{ y: -2, transition: { duration: 0.2 } }}
                              className="rounded-2xl border border-slate-700/60 overflow-hidden shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 hover:border-slate-600/60 transition-shadow"
                            >
                              <div className="flex items-center justify-between border-b border-slate-700/60 bg-slate-900/80 px-4 py-2.5">
                                <span className="text-sm font-medium text-slate-300">{ex.title}</span>
                                <div className="flex gap-1.5">
                                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/40" />
                                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/40" />
                                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/40" />
                                </div>
                              </div>
                              <Editor
                                height="160px"
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
                          )
                        )}
                      </div>
                    </Section>
                  )}

                  {/* ── Legacy: visualizer ── */}
                  {c.visualizations && c.visualizations.length > 0 && (
                    <Section id="sec-visualizer">
                      <SectionHeading icon={<PlayCircle />} label="Step-by-step" iconClass="text-fuchsia-400" />
                      <div className="space-y-4">
                        {c.visualizations.map(
                          (viz: { title: string; code: string; steps: unknown[] }, i: number) => (
                            <CodeVisualizer key={i} title={viz.title} code={viz.code} steps={viz.steps as never} />
                          )
                        )}
                      </div>
                    </Section>
                  )}
                </>
              )}

              {/* ── Workshop ── */}
              {c.workshops && c.workshops.length > 0 && (
                <Section id="sec-practice">
                  <SectionHeading icon={<Wrench />} label="Practice exercise" iconClass="text-orange-400" />
                  <Callout type="important" title="Challenge">
                    Try to figure out the answer before peeking at hints. Reading code without running it builds real understanding.
                  </Callout>
                  <div className="mt-4">
                    <WorkshopExercise workshop={c.workshops[0]} onComplete={handleWorkshopComplete} />
                  </div>
                </Section>
              )}

              {/* ── Summary ── */}
              {c.summary && (
                <Section id="sec-summary">
                  <motion.div
                    className="relative overflow-hidden flex items-start gap-4 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/8 to-emerald-500/3 p-5"
                    whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
                  >
                    {/* decorative glow */}
                    <div className="absolute inset-0 rounded-2xl pointer-events-none bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.08),transparent_60%)]" />
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500 mb-1.5">
                        You've got this
                      </p>
                      <p className="text-sm leading-relaxed text-slate-200 font-medium">{c.summary}</p>
                    </div>
                  </motion.div>
                </Section>
              )}

              {/* Back to path */}
              <Section>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="group flex w-full items-center justify-between rounded-2xl border border-slate-700/50 bg-slate-800/30 px-5 py-4 transition-all hover:border-sky-500/40 hover:bg-sky-500/5"
                >
                  <span className="text-sm font-medium text-slate-400 group-hover:text-slate-200">
                    Back to your learning path
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-sky-400 transition-colors" />
                </button>
              </Section>

              <div className="h-8" />
            </div>
          ) : (
            /* Content still generating */
            <div className="flex items-center justify-center h-full px-6">
              <div className="flex flex-col items-center gap-5 text-center max-w-sm">
                <motion.div
                  animate={{ rotate: [0, 12, -12, 0] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                >
                  <Sparkles className="h-10 w-10 text-sky-400" />
                </motion.div>
                <div>
                  <p className="font-semibold text-slate-200 mb-2">Content is being prepared</p>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Your lesson is generating in the background. You can ask your AI mentor questions on the right while you wait.
                  </p>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ RIGHT — AI mentor ══════════════════════════════════════════════ */}
      <div className="flex w-[42%] flex-col bg-slate-900/50 overflow-hidden">

        {/* Chat header */}
        <div className="border-b border-slate-700/50 bg-slate-900/90 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15">
              <MessageSquare className="h-4 w-4 text-sky-400" />
            </div>
            <div>
              <span className="font-semibold text-white text-sm">AI Mentor</span>
              <p className="text-xs text-slate-500 leading-none mt-0.5">Guides you — never gives direct answers</p>
            </div>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs text-emerald-400">Ready</span>
            </span>
          </div>

          {/* Hint level selector */}
          <div className="mt-3">
            <p className="text-xs text-slate-600 mb-1.5">Hint level</p>
            <div className="grid grid-cols-4 gap-1">
              {HINT_LEVELS.map((h) => (
                <motion.button
                  key={h.level}
                  onClick={() => setHintLevel(h.level)}
                  whileTap={{ scale: 0.94 }}
                  className={cn(
                    "rounded-lg px-2 py-1.5 text-xs font-medium transition-all border text-center",
                    hintLevel === h.level
                      ? "border-sky-500/60 bg-sky-500/15 text-sky-300 shadow-[0_0_8px_rgba(14,165,233,0.15)]"
                      : "border-slate-700/60 text-slate-600 hover:border-slate-600 hover:text-slate-400"
                  )}
                >
                  <span className="block">{h.label}</span>
                </motion.button>
              ))}
            </div>
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
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 border border-sky-500/20">
                  <MessageSquare className="h-6 w-6 text-sky-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-300 text-sm">Ask your AI mentor</p>
                  <p className="text-xs text-slate-600 mt-1 max-w-[200px]">
                    I'll ask questions to help you think it through — not just tell you the answer.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 w-full max-w-[240px]">
                  {["What does this concept do?", "I don't understand the code", "Why does this matter?"].map((s) => (
                    <button
                      key={s}
                      onClick={() => { setChatInput(s); }}
                      className="rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs text-slate-500 hover:border-slate-600 hover:text-slate-300 transition-colors text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-sky-500 text-white rounded-br-sm"
                      : "bg-slate-800/80 text-slate-200 rounded-bl-sm border border-slate-700/40"
                  )}
                >
                  <div className="prose prose-sm prose-invert max-w-none prose-p:my-0.5 prose-p:text-inherit prose-code:text-sky-300 prose-code:bg-slate-900/60 prose-code:text-[0.85em] prose-strong:text-white">
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
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-slate-800/80 border border-slate-700/40 px-4 py-3">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.55, repeat: Infinity, delay: i * 0.14, ease: "easeInOut" }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-slate-700/50 bg-slate-900/90 p-4 space-y-2.5 shrink-0">
          {/* Code share toggle */}
          <div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCodeInput((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                showCodeInput
                  ? "border-sky-500/50 bg-sky-500/10 text-sky-400"
                  : "border-slate-700/60 text-slate-600 hover:border-slate-600 hover:text-slate-400"
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
                transition={{ duration: 0.22 }}
                className="overflow-hidden rounded-xl border border-slate-700/60"
              >
                <Editor
                  height="100px"
                  language="python"
                  value={codeContext}
                  onChange={(v) => setCodeContext(v ?? "")}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 12,
                    lineNumbers: "off",
                    folding: false,
                    overviewRulerLanes: 0,
                    padding: { top: 6, bottom: 6 },
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
              className="flex-1 resize-none rounded-xl border border-slate-700/60 bg-slate-800/50 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30"
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
        </div>
      </div>
    </div>
  );
}
