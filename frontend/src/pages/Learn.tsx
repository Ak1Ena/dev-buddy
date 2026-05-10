"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Loader2, ChevronLeft, X, MessageSquare,
  BookOpen, Lightbulb, Wrench, Sparkles,
  Brain, List, Zap, Shield,
  Activity, Cpu, Globe, Database, Lock, Settings
} from "lucide-react";
import toast from "react-hot-toast";
import { learningApi, chatApi } from "@/lib/api";
import type { Lesson, ChatMessage, AnimationFrame } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import AnimationPlayer from "@/components/lesson/AnimationPlayer";
import CodeWalkthrough from "@/components/lesson/CodeWalkthrough";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { topicLabel, cn } from "@/lib/utils";

/* ── Mastery Icon Mapping ── */
const getMasteryIcon = (name?: string) => {
  if (!name) return <Brain className="h-5 w-5" />;
  const icons: Record<string, any> = {
    brain: Brain,
    zap: Zap,
    shield: Shield,
    activity: Activity,
    cpu: Cpu,
    globe: Globe,
    database: Database,
    lock: Lock,
    settings: Settings,
    lightbulb: Lightbulb,
    book: BookOpen,
    wrench: Wrench,
  };
  const Icon = icons[name.toLowerCase()] || Brain;
  return <Icon className="h-5 w-5" />;
};

/* ── chat-message segmentation ── */
type ChatSegment =
  | { kind: "md"; text: string }
  | { kind: "anim"; frames: AnimationFrame[] }
  | { kind: "feedback"; correct: boolean | null; summary: string; explanation: string; next_step?: string };

function parseChatMessage(content: string): { segments: ChatSegment[]; hasAnim: boolean } {
  const segments: ChatSegment[] = [];
  const re = /```(animation|feedback)\s*\n([\s\S]*?)\n```/gi;
  let last = 0;
  let hasAnim = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) segments.push({ kind: "md", text: content.slice(last, m.index) });
    const tag = m[1].toLowerCase();
    const body = m[2];
    try {
      const parsed = JSON.parse(body);
      if (tag === "animation") {
        const frames = Array.isArray(parsed) ? parsed : [parsed];
        if (frames.length && frames.every((f) => f && typeof f === "object")) {
          segments.push({ kind: "anim", frames: frames as AnimationFrame[] });
          hasAnim = true;
        } else {
          segments.push({ kind: "md", text: m[0] });
        }
      } else if (tag === "feedback" && parsed && typeof parsed === "object") {
        segments.push({
          kind: "feedback",
          correct: parsed.correct ?? null,
          summary: parsed.summary ?? "",
          explanation: parsed.explanation ?? "",
          next_step: parsed.next_step,
        });
      } else {
        segments.push({ kind: "md", text: m[0] });
      }
    } catch {
      segments.push({ kind: "md", text: m[0] });
    }
    last = re.lastIndex;
  }
  if (last < content.length) segments.push({ kind: "md", text: content.slice(last) });
  if (segments.length === 0) segments.push({ kind: "md", text: content });
  return { segments, hasAnim };
}

/* ── UI Components ── */
function Section({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({ icon, label, iconClass }: { icon: React.ReactNode; label: string; iconClass?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className={cn("h-4 w-4", iconClass)}>{icon}</span>
      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </span>
    </div>
  );
}

const HINT_LEVELS = [
  { level: 0, label: "Question" },
  { level: 1, label: "Concept" },
  { level: 2, label: "Direction" },
  { level: 3, label: "Example" },
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
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isCheckpoint, setIsCheckpoint] = useState(false);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [chatOpen, setChatOpen] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const scrollTicking = useRef(false);

  const handleContentScroll = useCallback(() => {
    if (!scrollTicking.current) {
      window.requestAnimationFrame(() => {
        const el = contentScrollRef.current;
        if (el) {
          const { scrollTop, scrollHeight, clientHeight } = el;
          const total = scrollHeight - clientHeight;
          const progress = total > 0 ? Math.min(100, (scrollTop / total) * 100) : 0;
          setScrollProgress(progress);
          
          // Sync logic: jump to frame based on progress
          if (lesson?.content?.animation_frames) {
            const frameCount = lesson.content.animation_frames.length;
            const targetFrame = Math.min(frameCount - 1, Math.floor((progress / 100) * frameCount));
            // We only set current frame if it changed and it's not a checkpoint
            if (targetFrame !== currentFrame && !isCheckpoint) {
              // Note: AnimationPlayer will need to listen to this or we need a way to control it.
              // For now, let's just keep the progress synced.
            }
          }
        }
        scrollTicking.current = false;
      });
      scrollTicking.current = true;
    }
  }, [lesson?.content?.animation_frames, currentFrame, isCheckpoint]);

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

  useEffect(() => {
    if (!lessonId || lesson?.content) return;
    const t = setInterval(async () => {
      try {
        const res = await learningApi.getLesson(lessonId);
        if (res.data.content) {
          setLesson(res.data);
          clearInterval(t);
        }
      } catch { /* silent */ }
    }, 4000);
    return () => clearInterval(t);
  }, [lessonId, lesson?.content]);

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
        hint_level: hintLevel,
        current_frame: currentFrame,
        is_checkpoint: isCheckpoint,
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

  const handleFrameChange = useCallback((idx: number, isCp: boolean) => {
    setCurrentFrame(idx);
    setIsCheckpoint(isCp);
  }, []);

  if (loadingLesson) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-950 mesh-gradient">
        <div className="flex flex-col items-center gap-6">
          <motion.div 
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1],
              opacity: [0.5, 1, 0.5]
            }} 
            transition={{ 
              rotate: { repeat: Infinity, duration: 2, ease: "linear" },
              scale: { repeat: Infinity, duration: 2 },
              opacity: { repeat: Infinity, duration: 2 }
            }}
            className="relative"
          >
            <div className="absolute inset-0 blur-2xl bg-sky-500/30 rounded-full" />
            <Loader2 className="h-12 w-12 text-sky-400 relative z-10" />
          </motion.div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Initiating Logic Bridge</h2>
            <p className="text-slate-500 text-sm font-medium">Preparing technical mastery session…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!lesson) return null;
  const c = lesson.content;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-slate-950">
      <ErrorBoundary>
        {/* ── HEADER: Lesson title + completion ── */}
        <div className="relative shrink-0 border-b border-slate-800/60 bg-slate-900/20">
          <div className="absolute top-0 left-0 h-[1px] w-full bg-slate-800/40 z-10">
            <motion.div
              className="h-full bg-gradient-to-r from-sky-500 via-fuchsia-500 to-emerald-500 origin-left shadow-[0_0_10px_rgba(56,189,248,0.5)]"
              style={{ scaleX: scrollProgress / 100 }}
              transition={{ type: "spring", stiffness: 400, damping: 45 }}
            />
          </div>

          <div className="flex items-center justify-between px-6 py-4 bg-slate-950/40 backdrop-blur-sm">
            <div className="flex items-center gap-6">
              <button
                onClick={() => {
                  if (lesson?.space_id) navigate(`/space/${lesson.space_id}`);
                  else navigate("/dashboard");
                }}
                className="group flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-sky-400 transition-all"
              >
                <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Exit Space
              </button>
              <div className="h-4 w-[1px] bg-slate-800" />
              <div className="flex flex-col">
                <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  {lesson.title}
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-sky-500/30 text-sky-400 font-bold uppercase tracking-tighter">
                    {topicLabel(lesson.topic)}
                  </Badge>
                </h1>
                <span className="text-[10px] font-medium text-slate-500">Mastery Path • {lesson.difficulty}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">Completion</span>
                <span className="text-xs font-mono font-bold text-sky-400">{Math.round(scrollProgress)}%</span>
              </div>
              <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <motion.div
                  className="h-full bg-sky-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${scrollProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── TOP: Teaching (left) + Animation (right) ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* LEFT: Technical Mastery */}
          <div
            ref={contentScrollRef}
            onScroll={handleContentScroll}
            className="w-[58%] flex flex-col border-r border-slate-800/60 overflow-y-auto bg-slate-950/20 scroll-smooth"
          >
            {c ? (
              <div className="px-10 py-12 space-y-16 max-w-4xl mx-auto w-full">
                {c.key_concepts && (
                  <Section id="sec-concepts">
                    <SectionHeading icon={<Lightbulb />} label="Conceptual Targets" iconClass="text-amber-400" />
                    <div className="flex flex-wrap gap-3">
                      {c.key_concepts.map((concept: string) => (
                        <Badge key={concept} variant="secondary" className="bg-slate-900/60 backdrop-blur-sm text-slate-300 border-slate-800 px-3 py-1 text-xs font-medium hover:border-sky-500/30 transition-colors">
                          {concept}
                        </Badge>
                      ))}
                    </div>
                  </Section>
                )}

                {c.deep_dive && (
                  <Section id="sec-deep-dive">
                    <SectionHeading icon={<Brain />} label={c.deep_dive.title || "Architectural Insight"} iconClass="text-sky-400" />
                    
                    {c.deep_dive.cards && c.deep_dive.cards.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {c.deep_dive.cards.map((card, idx) => (
                          <Card 
                            key={idx}
                            onMouseEnter={() => setHighlightedNodeIds(card.related_nodes || [])}
                            onMouseLeave={() => setHighlightedNodeIds([])}
                            className="group relative overflow-hidden bg-slate-900/40 border-slate-800/60 hover:border-sky-500/50 transition-all duration-300 p-6 glass-card"
                          >
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                              {getMasteryIcon(card.icon)}
                            </div>
                            <div className="flex items-center gap-3 mb-3">
                              <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center border border-sky-500/20 text-sky-400">
                                {getMasteryIcon(card.icon)}
                              </div>
                              <h4 className="font-bold text-slate-100 group-hover:text-sky-300 transition-colors">{card.title}</h4>
                            </div>
                            <div className="prose prose-sm prose-invert max-w-none text-slate-400 group-hover:text-slate-300 transition-colors">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.content || ""}</ReactMarkdown>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl glass-card p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity">
                          <Brain className="h-24 w-24 text-sky-400" />
                        </div>
                        <div className="prose prose-sm prose-invert max-w-none prose-p:leading-8 prose-p:text-slate-300 prose-headings:text-white prose-strong:text-sky-300">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.deep_dive.content || ""}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </Section>
                )}

                {c.code_walkthrough && c.code_walkthrough.length > 0 && (
                  <Section id="sec-walkthrough">
                    <SectionHeading icon={<List />} label="Implementation Walkthrough" iconClass="text-fuchsia-400" />
                    <div className="rounded-2xl border border-slate-800/40 bg-slate-900/20 p-1">
                      <CodeWalkthrough items={c.code_walkthrough} />
                    </div>
                  </Section>
                )}

                {(!c.code_walkthrough || c.code_walkthrough.length === 0) && c.explanation && (
                  <Section id="sec-explanation">
                    <SectionHeading icon={<BookOpen />} label="The Breakdown" iconClass="text-sky-400" />
                    <div className="prose prose-sm prose-invert max-w-none text-slate-300 leading-8 text-lg font-medium italic opacity-90">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.explanation}</ReactMarkdown>
                    </div>
                  </Section>
                )}

                {c.workshops && c.workshops.length > 0 && (
                  <Section id="sec-practice">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 shadow-[0_0_40px_rgba(16,185,129,0.05)] flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                      <div className="space-y-3 max-w-xl">
                        <SectionHeading icon={<Wrench />} label="Mastery Challenge" iconClass="text-emerald-400" />
                        <h3 className="text-xl font-bold text-white tracking-tight">Ready to apply this?</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                          {c.workshops[0].description ?? "Test your understanding with a focused exercise."}
                        </p>
                      </div>
                      <Button
                        onClick={() => navigate(`/learn/${lessonId}/workshop`)}
                        size="lg"
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-8 h-12 rounded-xl shadow-lg shadow-emerald-500/20 group transition-all"
                      >
                        Start Workshop
                        <Wrench className="ml-2 h-4 w-4 transition-transform group-hover:rotate-12" />
                      </Button>
                    </div>
                  </Section>
                )}
                <div className="h-24" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-slate-800" />
                <p className="text-slate-600 text-sm font-bold uppercase tracking-widest">Awaiting Technical Analysis</p>
              </div>
            )}
          </div>

          {/* RIGHT of top split: Animation panel */}
          <div className="w-[42%] flex flex-col bg-slate-900/20 overflow-y-auto mesh-gradient">
            <div className="p-4 min-h-full">
              {c?.animation_frames && c.animation_frames.length > 0 ? (
                <AnimationPlayer
                  frames={c.animation_frames}
                  activeFrameIndex={currentFrame}
                  highlightedNodeIds={highlightedNodeIds}
                  onFrameChange={handleFrameChange}
                />
              ) : (
                <div className="flex items-center justify-center h-full min-h-[400px]">
                  <div className="flex flex-col items-center gap-6 text-center max-w-sm">
                    <div className="relative">
                      <Sparkles className="h-12 w-12 text-sky-500/40 animate-pulse" />
                      <motion.div
                        animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.5, 0.2] }}
                        transition={{ repeat: Infinity, duration: 3 }}
                        className="absolute inset-0 bg-sky-500/20 blur-xl rounded-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-bold text-slate-300">Synthesizing Logic Topology</p>
                      <p className="text-xs text-slate-500 leading-relaxed uppercase tracking-widest font-medium">Mapping execution branches and data flows...</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Floating Chat: FAB + popover panel ── */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              key="chat-panel"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="fixed bottom-24 right-6 z-40 w-[400px] max-w-[calc(100vw-3rem)] h-[560px] max-h-[calc(100vh-10rem)] flex flex-col rounded-2xl border border-slate-700/50 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden"
            >
              {/* Header */}
              <div className="border-b border-slate-800/60 bg-slate-950/40 px-4 py-3 shrink-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center border border-sky-500/20 shrink-0">
                    <MessageSquare className="h-4 w-4 text-sky-400" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block leading-none mb-0.5">AI Mentor</span>
                    <span className="text-xs font-bold text-white tracking-tight truncate block">Senior Lead Engineer</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-tighter">Live</span>
                  </div>
                  <button
                    onClick={() => setChatOpen(false)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
                    aria-label="Close chat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Hint selector */}
              <div className="bg-slate-950/40 border-b border-slate-800/60 shrink-0 px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.15em] shrink-0">Depth</span>
                  <div className="grid grid-cols-4 gap-1 flex-1">
                    {HINT_LEVELS.map((h) => (
                      <button
                        key={h.level}
                        onClick={() => setHintLevel(h.level)}
                        className={cn(
                          "rounded px-1.5 py-1 text-[9px] font-bold uppercase tracking-tighter transition-all border",
                          hintLevel === h.level
                            ? "border-sky-500/40 bg-sky-500/20 text-sky-300"
                            : "border-slate-800 bg-slate-900/40 text-slate-500 hover:text-slate-300"
                        )}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 selection:bg-sky-500/30">
                <AnimatePresence initial={false}>
                  {messages.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-40"
                    >
                      <MessageSquare className="h-10 w-10 text-slate-700" />
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Start the Socratic Dialogue</p>
                    </motion.div>
                  )}
                  {messages.map((msg) => {
                    const { segments } = msg.role === "assistant"
                      ? parseChatMessage(msg.content)
                      : { segments: [{ kind: "md", text: msg.content } as ChatSegment] };
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[88%] shadow-lg",
                            msg.role === "user"
                              ? "bg-sky-600 text-white rounded-br-sm shadow-sky-900/20"
                              : "bg-slate-800/60 glass-panel text-slate-200 rounded-bl-sm border border-slate-700/40"
                          )}
                        >
                          <div className="space-y-3">
                            {segments.map((seg, i) =>
                              seg.kind === "md" && seg.text.trim() ? (
                                <div key={i} className="prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-p:text-slate-300 prose-strong:text-sky-300">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.text}</ReactMarkdown>
                                </div>
                              ) : seg.kind === "feedback" ? (
                                <div key={i} className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs shadow-inner">
                                  <p className="font-bold text-sky-400 mb-1.5 flex items-center gap-2">
                                    <Brain className="h-3 w-3" />
                                    {seg.summary}
                                  </p>
                                  <p className="text-slate-300 leading-relaxed italic">{seg.explanation}</p>
                                </div>
                              ) : null
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-3 py-3 border-t border-slate-800/60 bg-slate-950/40 backdrop-blur-sm shrink-0">
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-500 to-fuchsia-500 rounded-2xl opacity-0 group-focus-within:opacity-20 transition-opacity blur" />
                  <div className="relative flex gap-2">
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask a technical question..."
                      rows={1}
                      className="flex-1 resize-none rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-sky-500/50 outline-none transition-all"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim() || chatLoading}
                      loading={chatLoading}
                      size="sm"
                      className="h-10 w-10 shrink-0 p-0 rounded-xl bg-sky-600 hover:bg-sky-500 shadow-lg shadow-sky-900/40"
                    >
                      {!chatLoading && <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Action Button */}
        <motion.button
          onClick={() => setChatOpen((v) => !v)}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className={cn(
            "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full flex items-center justify-center shadow-xl transition-colors",
            chatOpen
              ? "bg-slate-800 text-slate-300 hover:bg-slate-700 ring-1 ring-slate-600"
              : "bg-sky-600 text-white hover:bg-sky-500 shadow-sky-900/40 ring-2 ring-sky-400/40"
          )}
          aria-label={chatOpen ? "Close AI Mentor chat" : "Open AI Mentor chat"}
        >
          {chatOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <>
              <MessageSquare className="h-6 w-6" />
              {messages.some((m) => m.role === "assistant") === false && messages.length === 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-fuchsia-500 ring-2 ring-slate-950 animate-pulse" />
              )}
            </>
          )}
        </motion.button>
      </ErrorBoundary>
    </div>
  );
}
