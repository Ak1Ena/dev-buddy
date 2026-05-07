import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Code2,
  Loader2,
  ChevronLeft,
  MessageSquare,
  BookOpen,
  FlaskConical,
  Eye,
  Wrench,
} from "lucide-react";
import toast from "react-hot-toast";
import { learningApi, chatApi } from "@/lib/api";
import type { Lesson, ChatMessage } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CodeVisualizer from "@/components/visualization/CodeVisualizer";
import WorkshopExercise from "@/components/lesson/WorkshopExercise";
import { topicLabel, cn } from "@/lib/utils";

type LearnTab = "learn" | "examples" | "visualizer" | "workshop";

const HINT_LEVELS = [
  { level: 0, label: "Ask anything" },
  { level: 1, label: "Concept hint" },
  { level: 2, label: "Direction hint" },
  { level: 3, label: "Guided example" },
];

export default function Learn() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();

  /* Lesson state */
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loadingLesson, setLoadingLesson] = useState(true);

  /* Tab state */
  const [activeTab, setActiveTab] = useState<LearnTab>("learn");

  /* Chat state */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | undefined>();
  const [hintLevel, setHintLevel] = useState(0);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeContext, setCodeContext] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, chatLoading, scrollToBottom]);

  useEffect(() => {
    if (!lessonId) return;

    const fetchLesson = async () => {
      setLoadingLesson(true);
      try {
        const res = await learningApi.getLesson(lessonId);
        setLesson(res.data);
        // Mark as in_progress
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

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      metadata: null,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
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

      // Capture session_id from first response
      if (!chatSessionId && data.session_id) {
        setChatSessionId(data.session_id);
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response ?? data.message ?? "I'm here to help!",
        metadata: null,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      toast.error("Failed to send message.");
      setMessages((prev) => prev.slice(0, -1)); // remove optimistic user message
      setChatInput(trimmed);
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleWorkshopComplete = async (score: number) => {
    if (!lessonId) return;
    try {
      await learningApi.updateProgress(lessonId, {
        workshop_score: score,
        status: score > 0 ? "completed" : "in_progress",
      });
      if (score > 0) toast.success(`Workshop complete! Score: ${score}/100`);
    } catch {
      // silent
    }
  };

  /* ── Loading ── */
  if (loadingLesson) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
          <p className="text-slate-400">Loading lesson…</p>
        </div>
      </div>
    );
  }

  if (!lesson) return null;

  const content = lesson.content;
  const tabs: { id: LearnTab; label: string; icon: React.ReactNode }[] = [
    { id: "learn", label: "Learn", icon: <BookOpen className="h-4 w-4" /> },
    { id: "examples", label: "Examples", icon: <Code2 className="h-4 w-4" /> },
    { id: "visualizer", label: "Visualizer", icon: <Eye className="h-4 w-4" /> },
    { id: "workshop", label: "Workshop", icon: <Wrench className="h-4 w-4" /> },
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── LEFT PANEL — Lesson Content ── */}
      <div className="flex w-[60%] flex-col border-r border-slate-700 overflow-hidden">
        {/* Lesson header */}
        <div className="border-b border-slate-700 bg-slate-800/50 px-6 py-4 shrink-0">
          <button
            onClick={() => navigate("/dashboard")}
            className="mb-3 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-slate-100 leading-tight">
                {lesson.title}
              </h1>
              {lesson.description && (
                <p className="mt-1 text-sm text-slate-400">{lesson.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="default">{topicLabel(lesson.topic)}</Badge>
              <Badge variant="secondary" className="capitalize">
                {lesson.difficulty}
              </Badge>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-slate-700 bg-slate-800/30 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-5 py-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-sky-500 text-sky-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* LEARN TAB */}
          {activeTab === "learn" && content && (
            <div className="max-w-none space-y-6">
              <div className="prose prose-invert prose-sm max-w-none prose-headings:text-slate-100 prose-p:text-slate-300 prose-code:text-sky-300 prose-code:bg-slate-800 prose-pre:bg-slate-900 prose-strong:text-slate-100 prose-a:text-sky-400">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content.explanation}
                </ReactMarkdown>
              </div>

              {/* Key concepts */}
              {content.key_concepts.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
                    Key Concepts
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {content.key_concepts.map((concept) => (
                      <span
                        key={concept}
                        className="rounded-full bg-sky-500/10 px-3 py-1 text-sm font-medium text-sky-300 border border-sky-500/20"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              {content.summary && (
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
                    Summary
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {content.summary}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* EXAMPLES TAB */}
          {activeTab === "examples" && content && (
            <div className="space-y-8">
              {content.code_examples.length === 0 ? (
                <p className="text-center text-slate-400">No examples for this lesson.</p>
              ) : (
                content.code_examples.map((example, i) => (
                  <div key={i} className="space-y-3">
                    <h3 className="font-semibold text-slate-100">{example.title}</h3>
                    <div className="overflow-hidden rounded-xl border border-slate-700">
                      <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-900/60 px-3 py-2">
                        <div className="flex gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                        </div>
                        <span className="text-xs text-slate-500">
                          {example.language}
                        </span>
                      </div>
                      <Editor
                        height="200px"
                        language={example.language ?? "python"}
                        value={example.code}
                        theme="vs-dark"
                        options={{
                          readOnly: true,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          fontSize: 13,
                          lineNumbers: "on",
                          renderLineHighlight: "none",
                          contextmenu: false,
                          folding: false,
                          overviewRulerLanes: 0,
                        }}
                      />
                    </div>
                    {example.explanation && (
                      <p className="text-sm leading-relaxed text-slate-400">
                        {example.explanation}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* VISUALIZER TAB */}
          {activeTab === "visualizer" && content && (
            <div className="space-y-6">
              {content.visualizations.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 py-16 text-center">
                  <Eye className="mb-3 h-10 w-10 text-slate-600" />
                  <p className="text-slate-400">No visualizer for this lesson.</p>
                </div>
              ) : (
                content.visualizations.map((viz, i) => (
                  <CodeVisualizer
                    key={i}
                    title={viz.title}
                    code={viz.code}
                    steps={viz.steps}
                  />
                ))
              )}
            </div>
          )}

          {/* WORKSHOP TAB */}
          {activeTab === "workshop" && content && (
            <div>
              {content.workshops.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 py-16 text-center">
                  <Wrench className="mb-3 h-10 w-10 text-slate-600" />
                  <p className="text-slate-400">No workshop for this lesson.</p>
                </div>
              ) : (
                <WorkshopExercise
                  workshop={content.workshops[0]}
                  onComplete={handleWorkshopComplete}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL — AI Chat ── */}
      <div className="flex w-[40%] flex-col bg-slate-800/30 overflow-hidden">
        {/* Chat header */}
        <div className="border-b border-slate-700 bg-slate-800/50 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-sky-400" />
            <span className="font-semibold text-slate-100">AI Mentor</span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs text-emerald-400">Online</span>
            </span>
          </div>

          {/* Hint level pills */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {HINT_LEVELS.map((h) => (
              <button
                key={h.level}
                onClick={() => setHintLevel(h.level)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors border",
                  hintLevel === h.level
                    ? "border-sky-500 bg-sky-500/20 text-sky-300"
                    : "border-slate-600 bg-transparent text-slate-400 hover:border-slate-500 hover:text-slate-300"
                )}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10">
                <MessageSquare className="h-7 w-7 text-sky-400" />
              </div>
              <div>
                <p className="font-medium text-slate-300">Ask your AI mentor</p>
                <p className="mt-1 text-sm text-slate-500">
                  Ask about this lesson, share code, or request hints.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-sky-500 text-white rounded-br-md"
                    : "bg-slate-700 text-slate-200 rounded-bl-md"
                )}
              >
                <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-p:text-inherit prose-code:text-sky-300 prose-code:bg-slate-800 prose-pre:bg-slate-900">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {/* Thinking indicator */}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-slate-700 px-4 py-3">
                <span className="text-sm text-slate-400">Thinking</span>
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat input area */}
        <div className="border-t border-slate-700 bg-slate-800/50 p-4 space-y-3 shrink-0">
          {/* Share code toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCodeInput((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                showCodeInput
                  ? "border-sky-500 bg-sky-500/10 text-sky-400"
                  : "border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300"
              )}
            >
              <Code2 className="h-3.5 w-3.5" />
              Share Code
              {showCodeInput && <span className="text-sky-300">✓</span>}
            </button>
            {showCodeInput && (
              <span className="text-xs text-slate-500">
                Your code will be sent with your message
              </span>
            )}
          </div>

          {/* Monaco code editor (when share code is active) */}
          {showCodeInput && (
            <div className="overflow-hidden rounded-lg border border-slate-600">
              <Editor
                height="120px"
                language={lesson.topic === "javascript" ? "javascript" : "python"}
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
                  padding: { top: 8, bottom: 8 },
                }}
              />
            </div>
          )}

          {/* Message textarea + send */}
          <div className="flex gap-2">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question… (Enter to send)"
              rows={2}
              className="flex-1 resize-none rounded-xl border border-slate-600 bg-slate-700/50 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || chatLoading}
              loading={chatLoading}
              size="sm"
              className="self-end h-10 w-10 shrink-0 p-0"
              aria-label="Send message"
            >
              {!chatLoading && <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-slate-600 text-center">
            <FlaskConical className="inline h-3 w-3 mr-1" />
            Socratic mode — your mentor guides, not gives answers
          </p>
        </div>
      </div>
    </div>
  );
}
