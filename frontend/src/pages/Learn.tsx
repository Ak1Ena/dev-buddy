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
import type { Lesson, ChatMessage, AnimationFrame, LessonProposal } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import AnimationPlayer from "@/components/lesson/AnimationPlayer";
import CodeWalkthrough from "@/components/lesson/CodeWalkthrough";
import LessonViz from "@/components/lesson/LessonViz";
import CodePanel from "@/components/lesson/CodePanel";
import CodeStepGraph from "@/components/lesson/CodeStepGraph";
import NodeDetail from "@/components/lesson/NodeDetail";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { useLessonHighlight } from "@/store/lessonHighlight";
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
  | { kind: "feedback"; correct: boolean | null; summary: string; explanation: string; next_step?: string }
  | { kind: "proposal"; data: LessonProposal };

function parseChatMessage(content: string): { segments: ChatSegment[]; hasAnim: boolean } {
  const segments: ChatSegment[] = [];
  const re = /```(animation|feedback|proposal)\s*\n([\s\S]*?)\n```/gi;
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
      } else if (tag === "proposal" && parsed && typeof parsed === "object") {
        segments.push({ kind: "proposal", data: parsed as LessonProposal });
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
  /** Lifted state for the controlled CodeWalkthrough / CodePanel. */
  const [currentWalkthroughIndex, setCurrentWalkthroughIndex] = useState(0);
  
  const clearHighlight = useLessonHighlight((s) => s.clear);
  
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
        }
        scrollTicking.current = false;
      });
      scrollTicking.current = true;
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, chatLoading, scrollToBottom]);

  useEffect(() => {
    if (!lessonId) return;
    setLesson(null);
    setMessages([]);
    setChatSessionId(undefined);
    setCurrentFrame(0);
    setIsCheckpoint(false);
    setCurrentWalkthroughIndex(0);
    setHintLevel(0);
    setHighlightedNodeIds([]);
    clearHighlight();
    setScrollProgress(0);
    (async () => {
      setLoadingLesson(true);
      try {
        const res = await learningApi.getLesson(lessonId);
        setLesson(res.data);
        const currentStatus = res.data?.progress?.status;
        if (!currentStatus || currentStatus === "not_started") {
          learningApi.updateProgress(lessonId, { status: "in_progress" }).catch(() => {});
        }
      } catch {
        toast.error("Failed to load lesson.");
        navigate("/dashboard");
      } finally {
        setLoadingLesson(false);
      }
    })();
  }, [lessonId, navigate, clearHighlight]);

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

  const handleAcceptProposal = async (proposal: LessonProposal) => {
    if (!chatSessionId) return;
    const t = toast.loading("Adding lesson to your plan...");
    try {
      await chatApi.acceptProposal({
        session_id: chatSessionId,
        ...proposal,
      });
      toast.success("Lesson added! You can find it in your learning plan.", { id: t });
      // Optionally refresh the lesson or path if needed, but for now just a success msg
      setMessages((p) => [
        ...p,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Great! I've added that lesson to your plan. We can continue our discussion here, or you can jump into the new lesson whenever you're ready.",
          metadata: null,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {
      toast.error("Failed to add lesson.", { id: t });
    }
  };

  const handleRejectProposal = async (topic: string) => {
    if (!chatSessionId) return;
    try {
      await chatApi.rejectProposal({
        session_id: chatSessionId,
        topic,
      });
      setMessages((p) => [
        ...p,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "No problem. Let's stay focused on our current topic then. Where were we?",
          metadata: null,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {
      // silent
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const stepToFrame = useCallback((stepIdx: number) => {
    const steps = lesson?.content?.code_walkthrough?.length ?? 0;
    const frames = lesson?.content?.animation_frames?.length ?? 0;
    if (frames === 0 || steps === 0) return 0;
    if (steps === 1) return 0;
    return Math.round((stepIdx / (steps - 1)) * (frames - 1));
  }, [lesson?.content?.code_walkthrough?.length, lesson?.content?.animation_frames?.length]);

  const frameToStep = useCallback((frameIdx: number) => {
    const steps = lesson?.content?.code_walkthrough?.length ?? 0;
    const frames = lesson?.content?.animation_frames?.length ?? 0;
    if (steps === 0 || frames === 0) return 0;
    if (frames === 1) return 0;
    return Math.round((frameIdx / (frames - 1)) * (steps - 1));
  }, [lesson?.content?.code_walkthrough?.length, lesson?.content?.animation_frames?.length]);

  const handleFrameChange = useCallback((idx: number, isCp: boolean) => {
    setCurrentFrame(idx);
    setIsCheckpoint(isCp);
    setCurrentWalkthroughIndex((prev) => {
      const next = frameToStep(idx);
      return next !== prev ? next : prev;
    });
  }, [frameToStep]);

  useEffect(() => {
    const frames = lesson?.content?.animation_frames;
    if (!frames?.length) return;
    const next = stepToFrame(currentWalkthroughIndex);
    if (next !== currentFrame) setCurrentFrame(next);
  }, [currentWalkthroughIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearHighlight();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearHighlight]);

  const handleJumpToCode = useCallback((idx: number) => {
    clearHighlight();
    setCurrentWalkthroughIndex(idx);
    const codeSection = document.getElementById("sec-execution");
    if (codeSection) {
      codeSection.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [clearHighlight]);

  if (loadingLesson) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-950 mesh-gradient">
        <div className="flex flex-col items-center gap-6">
          <motion.div 
            animate={{ rotate: 360, scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} 
            transition={{ rotate: { repeat: Infinity, duration: 2, ease: "linear" }, scale: { repeat: Infinity, duration: 2 }, opacity: { repeat: Infinity, duration: 2 } }}
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
  if (!c) return null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-slate-950">
      <ErrorBoundary>
        {/* ── HEADER ── */}
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
                <motion.div className="h-full bg-sky-500" initial={{ width: 0 }} animate={{ width: `${scrollProgress}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* ── LEFT: Unified Mastery Flow ── */}
          <div
            ref={contentScrollRef}
            onScroll={handleContentScroll}
            className="flex-1 overflow-y-auto bg-slate-950/20 scroll-smooth selection:bg-sky-500/20"
          >
            <div className="px-10 py-12 space-y-24 max-w-5xl mx-auto w-full">
              
              {/* 1. Hook & Context */}
              {c.concept_hook && (
                <Section id="sec-hook">
                  <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-fuchsia-500/5 to-transparent p-8 backdrop-blur-sm relative overflow-hidden">
                    <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
                    <div className="flex items-start gap-6 relative">
                      <div className="h-12 w-12 shrink-0 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shadow-lg shadow-sky-500/10">
                        <Sparkles className="h-6 w-6 text-sky-300" />
                      </div>
                      <div className="space-y-3 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-400/80">
                          Logic Foundation
                        </p>
                        <div className="prose prose-lg prose-invert max-w-none prose-p:text-slate-200 prose-p:leading-relaxed prose-strong:text-sky-300">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.concept_hook}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                </Section>
              )}

              {/* 2. Logic Topology (Hero Visualization) */}
              {c.viz && (
                <Section id="sec-topology">
                  <SectionHeading icon={<Activity />} label="Logic Topology" iconClass="text-emerald-400" />
                  <div className="relative h-[640px] w-full rounded-3xl border border-slate-800/60 bg-slate-950/60 shadow-2xl overflow-hidden group">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.03),transparent)] pointer-events-none" />
                    
                    {/* The Visualization Area (internal LessonViz handles scrolling) */}
                    <div className="h-full w-full relative">
                      <LessonViz
                        viz={c.viz}
                        onStepActivate={(idx) => typeof idx === "number" && handleJumpToCode(idx)}
                      />
                    </div>

                    {/* Docked Detail Panel (Bottom) */}
                    <div className="absolute bottom-6 left-6 right-6 pointer-events-none z-20">
                      <div className="pointer-events-auto max-w-4xl mx-auto">
                        <NodeDetail viz={c.viz} onJumpToCode={handleJumpToCode} />
                      </div>
                    </div>

                    {/* Interaction Hint */}
                    <div className="absolute top-4 right-6 pointer-events-none">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/40 border border-slate-700/50 backdrop-blur-md">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Node Interaction</span>
                        <div className="flex items-center gap-1">
                          <div className="h-1 w-3 rounded-full bg-sky-500/50" />
                          <span className="text-[9px] font-bold text-slate-400">Click to Inspect</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Section>
              )}

              {/* 3. Deep Dive & Concepts */}
              <div className="space-y-12">
                {c.key_concepts && (
                  <Section id="sec-concepts">
                    <SectionHeading icon={<Lightbulb />} label="Architectural Targets" iconClass="text-amber-400" />
                    <div className="flex flex-wrap gap-3">
                      {c.key_concepts.map((concept: string) => (
                        <Badge key={concept} variant="secondary" className="bg-slate-900/60 backdrop-blur-sm text-slate-300 border-slate-800 px-4 py-1.5 text-sm font-medium hover:border-sky-500/40 transition-all hover:scale-105">
                          {concept}
                        </Badge>
                      ))}
                    </div>
                  </Section>
                )}

                {c.deep_dive && (
                  <Section id="sec-deep-dive">
                    <SectionHeading icon={<Brain />} label={c.deep_dive.title || "The Mental Model"} iconClass="text-sky-400" />
                    {c.deep_dive.cards && c.deep_dive.cards.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {c.deep_dive.cards.map((card, idx) => (
                          <Card 
                            key={idx}
                            onMouseEnter={() => setHighlightedNodeIds(card.related_nodes || [])}
                            onMouseLeave={() => setHighlightedNodeIds([])}
                            className="group relative overflow-hidden bg-slate-900/40 border-slate-800/60 hover:border-sky-500/50 transition-all duration-500 p-8 glass-card"
                          >
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                              {getMasteryIcon(card.icon)}
                            </div>
                            <div className="flex items-center gap-4 mb-4">
                              <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20 text-sky-400 shadow-inner">
                                {getMasteryIcon(card.icon)}
                              </div>
                              <h4 className="text-lg font-bold text-slate-100 group-hover:text-sky-300 transition-colors tracking-tight">{card.title}</h4>
                            </div>
                            <div className="prose prose-sm prose-invert max-w-none text-slate-400 group-hover:text-slate-200 transition-colors leading-relaxed">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.content || ""}</ReactMarkdown>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-3xl glass-card p-10 relative overflow-hidden group border border-slate-800/40">
                        <div className="absolute top-0 right-0 p-10 opacity-[0.05] pointer-events-none group-hover:opacity-[0.1] transition-opacity">
                          <Brain className="h-32 w-32 text-sky-400" />
                        </div>
                        <div className="prose prose-lg prose-invert max-w-none prose-p:leading-relaxed prose-p:text-slate-300 prose-headings:text-white prose-strong:text-sky-300">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.deep_dive.content || ""}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </Section>
                )}
              </div>

              {/* 4. Interactive Execution (The "Code" Section) */}
              {c.code_walkthrough && c.code_walkthrough.length > 0 && (
                <Section id="sec-execution">
                  <SectionHeading icon={<Zap />} label="Live Execution Analysis" iconClass="text-fuchsia-400" />
                  <div className="h-[640px] flex flex-col lg:flex-row overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-900/20 shadow-2xl">
                    
                    {/* LEFT: Code Graph */}
                    <div className="lg:w-[40%] w-full h-1/2 lg:h-full border-b lg:border-b-0 lg:border-r border-slate-800/60 bg-slate-950/40 overflow-hidden flex flex-col">
                      <div className="shrink-0 px-4 py-3 bg-slate-950/60 border-b border-slate-800/60 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Logic Steps</span>
                        <span className="text-[10px] font-mono text-sky-500/60">{currentWalkthroughIndex + 1} / {c.code_walkthrough.length}</span>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <CodeStepGraph
                          items={c.code_walkthrough}
                          activeIndex={currentWalkthroughIndex}
                          onActiveIndexChange={setCurrentWalkthroughIndex}
                        />
                      </div>
                    </div>

                    {/* RIGHT: Animation & Interpretation */}
                    <div className="lg:w-[60%] w-full h-1/2 lg:h-full flex flex-col bg-slate-900/10 overflow-hidden relative">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(232,121,249,0.03),transparent)] pointer-events-none" />
                      
                      <div className="flex-1 min-h-0 overflow-hidden relative">
                        {c.animation_frames && c.animation_frames.length > 0 ? (
                          <AnimationPlayer
                            frames={c.animation_frames}
                            activeFrameIndex={currentFrame}
                            highlightedNodeIds={highlightedNodeIds}
                            onFrameChange={handleFrameChange}
                          />
                        ) : (
                          <div className="h-full flex items-center justify-center opacity-40">
                            <Cpu className="h-12 w-12 text-slate-700" />
                          </div>
                        )}
                      </div>

                      {/* WHY Footer */}
                      {c.code_walkthrough[currentWalkthroughIndex] && (
                        <div className="shrink-0 border-t border-slate-800/60 bg-slate-950/60 backdrop-blur-md px-6 py-5 max-h-[200px] overflow-y-auto">
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={currentWalkthroughIndex}
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              transition={{ duration: 0.2 }}
                              className="space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">Interpretation</span>
                              </div>
                              <p className="text-sm leading-relaxed text-slate-200 font-medium">
                                {c.code_walkthrough[currentWalkthroughIndex].plain_english}
                              </p>
                              {c.code_walkthrough[currentWalkthroughIndex].why && (
                                <div className="flex gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 shadow-inner">
                                  <Zap className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                                  <p className="text-xs leading-relaxed text-slate-300 italic">
                                    {c.code_walkthrough[currentWalkthroughIndex].why}
                                  </p>
                                </div>
                              )}
                            </motion.div>
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </div>
                </Section>
              )}

              {/* 5. Summary & Practice */}
              <div className="space-y-16">
                {c.summary && (
                  <Section id="sec-summary">
                    <SectionHeading icon={<Shield />} label="Consolidation" iconClass="text-emerald-400" />
                    <div className="rounded-3xl border border-slate-800/60 bg-slate-900/30 p-10 relative overflow-hidden">
                      <div className="absolute bottom-0 right-0 p-10 opacity-[0.03] pointer-events-none">
                        <Globe className="h-48 w-48 text-emerald-500" />
                      </div>
                      <div className="prose prose-lg prose-invert max-w-none text-slate-300 leading-relaxed prose-strong:text-emerald-400">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.summary}</ReactMarkdown>
                      </div>
                    </div>
                  </Section>
                )}

                {c.workshops && c.workshops.length > 0 && (
                  <Section id="sec-practice">
                    <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-10 shadow-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-8 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                        <Wrench className="h-40 w-40 text-emerald-500" />
                      </div>
                      <div className="space-y-4 max-w-2xl relative">
                        <SectionHeading icon={<Wrench />} label="Mastery Checkpoint" iconClass="text-emerald-400" />
                        <h3 className="text-2xl font-black text-white tracking-tight">Prove your understanding.</h3>
                        <p className="text-slate-400 leading-relaxed text-lg">
                          {c.workshops[0].description ?? "Test your intuition with a focused architectural challenge."}
                        </p>
                      </div>
                      <Button
                        onClick={() => navigate(`/learn/${lessonId}/workshop`)}
                        size="lg"
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-10 h-14 rounded-2xl shadow-xl shadow-emerald-500/20 group transition-all relative z-10"
                      >
                        Start Workshop
                        <ChevronLeft className="ml-2 h-5 w-5 rotate-180 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </div>
                  </Section>
                )}
              </div>
              
              <div className="h-32" />
            </div>
          </div>

          {/* ── RIGHT: AI Mentor Column ── */}
          <div className="w-[400px] hidden xl:flex flex-col border-l border-slate-800/60 bg-slate-900/40 backdrop-blur-md relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.05),transparent)] pointer-events-none" />
            
            {/* Chat Header */}
            <div className="shrink-0 border-b border-slate-800/60 bg-slate-950/60 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20 shadow-inner">
                  <MessageSquare className="h-5 w-5 text-sky-400" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block leading-none mb-1">AI Mentor</span>
                  <span className="text-sm font-bold text-white tracking-tight">Senior Lead Engineer</span>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">Live</span>
              </div>
            </div>

            {/* Hint Levels */}
            <div className="bg-slate-950/40 border-b border-slate-800/60 shrink-0 px-6 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Guidance Depth</span>
                <span className="text-[10px] font-mono text-sky-500/60">{HINT_LEVELS[hintLevel].label}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {HINT_LEVELS.map((h) => (
                  <button
                    key={h.level}
                    onClick={() => setHintLevel(h.level)}
                    className={cn(
                      "rounded-lg px-2 py-2 text-[10px] font-black uppercase tracking-tighter transition-all border",
                      hintLevel === h.level
                        ? "border-sky-500/40 bg-sky-500/20 text-sky-300 shadow-inner shadow-sky-500/20"
                        : "border-slate-800 bg-slate-900/40 text-slate-500 hover:text-slate-300"
                    )}
                  >
                    {h.label.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <AnimatePresence initial={false}>
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-20 grayscale">
                    <Brain className="h-16 w-16 text-slate-600" />
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Awaiting Socratic Input</p>
                  </div>
                )}
                {messages.map((msg) => {
                  const { segments } = msg.role === "assistant"
                    ? parseChatMessage(msg.content)
                    : { segments: [{ kind: "md", text: msg.content } as ChatSegment] };
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                    >
                      <div className={cn(
                        "rounded-2xl px-5 py-4 text-sm leading-relaxed max-w-[92%] shadow-xl",
                        msg.role === "user"
                          ? "bg-sky-600 text-white rounded-br-none shadow-sky-900/30"
                          : "bg-slate-800/60 border border-slate-700/40 text-slate-200 rounded-bl-none"
                      )}>
                        <div className="space-y-4">
                          {segments.map((seg, i) =>
                            seg.kind === "md" && seg.text.trim() ? (
                              <div key={i} className="prose prose-sm prose-invert max-w-none prose-p:text-slate-300 prose-strong:text-sky-300 prose-code:text-sky-300">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.text}</ReactMarkdown>
                              </div>
                            ) : seg.kind === "feedback" ? (
                              <div key={i} className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 shadow-inner">
                                <p className="font-black text-sky-400 text-[10px] uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <Brain className="h-3 w-3" />
                                  {seg.summary}
                                </p>
                                <p className="text-slate-300 leading-relaxed italic">{seg.explanation}</p>
                              </div>
                            ) : seg.kind === "proposal" ? (
                              <div key={i} className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-5 shadow-inner space-y-4">
                                <div className="flex items-start justify-between">
                                  <div className="space-y-1">
                                    <p className="font-black text-fuchsia-400 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                      <Sparkles className="h-3 w-3" />
                                      Mentor Recommendation
                                    </p>
                                    <h4 className="text-sm font-bold text-white">{seg.data.title}</h4>
                                  </div>
                                  <Badge variant="outline" className="text-[9px] border-fuchsia-500/30 text-fuchsia-400 font-bold uppercase">
                                    {seg.data.estimated_minutes} min
                                  </Badge>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">{seg.data.description}</p>
                                <div className="rounded-lg bg-slate-950/40 border border-fuchsia-500/10 p-3">
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-1">Why this helps</p>
                                  <p className="text-xs text-slate-400 italic leading-relaxed">{seg.data.rationale}</p>
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs h-8 rounded-lg"
                                    onClick={() => handleAcceptProposal(seg.data)}
                                  >
                                    Accept Lesson
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="flex-1 border-slate-700 text-slate-400 hover:text-white font-bold text-xs h-8 rounded-lg"
                                    onClick={() => handleRejectProposal(seg.data.topic)}
                                  >
                                    No Thanks
                                  </Button>
                                </div>
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

            {/* Chat Input */}
            <div className="px-6 py-6 border-t border-slate-800/60 bg-slate-950/60 backdrop-blur-md">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-fuchsia-500 rounded-2xl opacity-0 group-focus-within:opacity-20 transition-all blur-md" />
                <div className="relative flex gap-3">
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about the logic..."
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:border-sky-500/50 outline-none transition-all shadow-inner"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || chatLoading}
                    loading={chatLoading}
                    size="sm"
                    className="h-11 w-11 shrink-0 p-0 rounded-xl bg-sky-600 hover:bg-sky-500 shadow-lg shadow-sky-900/40 border border-sky-400/20"
                  >
                    {!chatLoading && <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Chat FAB for smaller screens */}
          <div className="xl:hidden">
            <AnimatePresence>
              {chatOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="fixed inset-4 md:left-auto md:w-[400px] z-50 rounded-3xl border border-slate-700/50 bg-slate-900/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden"
                >
                  {/* ... same chat content but with a close button ... */}
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                      <span className="font-bold">AI Mentor</span>
                      <Button variant="ghost" size="sm" onClick={() => setChatOpen(false)}><X className="h-4 w-4"/></Button>
                    </div>
                    {/* ... rest of chat messages and input ... */}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <Button
              onClick={() => setChatOpen(!chatOpen)}
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-sky-600 shadow-2xl z-40"
            >
              <MessageSquare />
            </Button>
          </div>
        </div>
      </ErrorBoundary>
    </div>
  );
}
