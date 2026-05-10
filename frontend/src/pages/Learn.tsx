"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Loader2, ChevronLeft, MessageSquare,
  BookOpen, Lightbulb, Wrench, Sparkles,
  CheckCircle2, Brain, List,
} from "lucide-react";
import toast from "react-hot-toast";
import { learningApi, chatApi } from "@/lib/api";
import type { Lesson, ChatMessage, AnimationFrame } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import WorkshopExercise from "@/components/lesson/WorkshopExercise";
import AnimationPlayer from "@/components/lesson/AnimationPlayer";
import CodeWalkthrough from "@/components/lesson/CodeWalkthrough";
import { topicLabel, cn } from "@/lib/utils";

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
      {/* ── TOP: Visual Hero (Logic Map) ── */}
      <div className="relative h-[48%] w-full shrink-0 border-b border-slate-800/60 bg-slate-900/20">
        <div className="absolute top-0 left-0 h-[1px] w-full bg-slate-800/40 z-10">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-500 via-fuchsia-500 to-emerald-500 origin-left shadow-[0_0_10px_rgba(56,189,248,0.5)]"
            style={{ scaleX: scrollProgress / 100 }}
            transition={{ type: "spring", stiffness: 400, damping: 45 }}
          />
        </div>

        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-6 py-4 shrink-0 bg-slate-950/40 backdrop-blur-sm border-b border-slate-800/40">
            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate(-1)}
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

          <div className="flex-1 overflow-hidden px-6 py-4 mesh-gradient">
            {c?.animation_frames ? (
              <div className="h-full max-w-[1400px] mx-auto">
                <AnimationPlayer 
                  frames={c.animation_frames} 
                  activeFrameIndex={currentFrame}
                  onFrameChange={(idx, isCp) => {
                    setCurrentFrame(idx);
                    setIsCheckpoint(isCp);
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
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

      {/* ── BOTTOM: Multi-Track Workspace ── */}
      <div className="flex flex-1 overflow-hidden">
        
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
                  <div className="rounded-2xl glass-card p-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity">
                      <Brain className="h-24 w-24 text-sky-400" />
                    </div>
                    <SectionHeading icon={<Brain />} label={c.deep_dive.title || "Architectural Insight"} iconClass="text-sky-400" />
                    <div className="prose prose-sm prose-invert max-w-none prose-p:leading-8 prose-p:text-slate-300 prose-headings:text-white prose-strong:text-sky-300">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.deep_dive.content}</ReactMarkdown>
                    </div>
                  </div>
                </Section>
              )}

              {c.code_walkthrough && (
                <Section id="sec-walkthrough">
                  <SectionHeading icon={<List />} label="Implementation Walkthrough" iconClass="text-fuchsia-400" />
                  <div className="rounded-2xl border border-slate-800/40 bg-slate-900/20 p-1">
                    <CodeWalkthrough items={c.code_walkthrough} />
                  </div>
                </Section>
              )}

              {!c.code_walkthrough && c.explanation && (
                <Section id="sec-explanation">
                  <SectionHeading icon={<BookOpen />} label="The Breakdown" iconClass="text-sky-400" />
                  <div className="prose prose-sm prose-invert max-w-none text-slate-300 leading-8 text-lg font-medium italic opacity-90">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.explanation}</ReactMarkdown>
                  </div>
                </Section>
              )}

              {c.workshops && c.workshops.length > 0 && (
                <Section id="sec-practice">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 shadow-[0_0_40px_rgba(16,185,129,0.05)]">
                    <SectionHeading icon={<Wrench />} label="Mastery Challenge" iconClass="text-emerald-400" />
                    <WorkshopExercise workshop={c.workshops[0]} onComplete={handleWorkshopComplete} />
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

        {/* RIGHT: AI Dialogue */}
        <div className="w-[42%] flex flex-col bg-slate-900/90 backdrop-blur-md border-l border-slate-800/40">
          <div className="border-b border-slate-800/60 bg-slate-950/40 px-6 py-4 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center border border-sky-500/20">
                <MessageSquare className="h-4 w-4 text-sky-400" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block leading-none mb-1">AI Mentor</span>
                <span className="text-xs font-bold text-white tracking-tight">Senior Lead Engineer</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-tighter">Connected</span>
            </div>
          </div>

          <div className="bg-slate-950/60 px-6 py-3 border-b border-slate-800/60 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">Socratic Depth</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {HINT_LEVELS.map((h) => (
                <button
                  key={h.level}
                  onClick={() => setHintLevel(h.level)}
                  className={cn(
                    "rounded-lg px-2 py-1.5 text-[9px] font-bold uppercase tracking-tighter transition-all border",
                    hintLevel === h.level
                      ? "border-sky-500/40 bg-sky-500/20 text-sky-300 shadow-[0_0_15px_rgba(14,165,233,0.15)]"
                      : "border-slate-800 bg-slate-900/40 text-slate-500 hover:text-slate-300"
                  )}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 selection:bg-sky-500/30">
            <AnimatePresence initial={false}>
              {messages.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40"
                >
                  <MessageSquare className="h-12 w-12 text-slate-700" />
                  <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">Start the Socratic Dialogue</p>
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
                        "rounded-2xl px-5 py-4 text-sm leading-relaxed max-w-[92%] shadow-lg",
                        msg.role === "user"
                          ? "bg-sky-600 text-white rounded-br-sm shadow-sky-900/20"
                          : "bg-slate-800/60 glass-panel text-slate-200 rounded-bl-sm border border-slate-700/40"
                      )}
                    >
                      <div className="space-y-4">
                        {segments.map((seg, i) =>
                          seg.kind === "md" && seg.text.trim() ? (
                            <div key={i} className="prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-p:text-slate-300 prose-strong:text-sky-300">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.text}</ReactMarkdown>
                            </div>
                          ) : seg.kind === "feedback" ? (
                            <div key={i} className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-xs shadow-inner">
                               <p className="font-bold text-sky-400 mb-2 flex items-center gap-2">
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

          <div className="p-6 border-t border-slate-800/60 bg-slate-950/40 backdrop-blur-sm shrink-0">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-500 to-fuchsia-500 rounded-2xl opacity-0 group-focus-within:opacity-20 transition-opacity blur" />
              <div className="relative flex gap-3">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a technical question..."
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:border-sky-500/50 outline-none transition-all"
                />
                <Button 
                  onClick={handleSendMessage} 
                  disabled={!chatInput.trim() || chatLoading} 
                  loading={chatLoading} 
                  size="sm" 
                  className="h-11 w-11 shrink-0 p-0 rounded-xl bg-sky-600 hover:bg-sky-500 shadow-lg shadow-sky-900/40"
                >
                  {!chatLoading && <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-center font-bold text-slate-600 uppercase tracking-widest">Socratic Mode Active</p>
          </div>
        </div>
      </div>
    </div>
  );
}
