"use client";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2, XCircle, Loader2, TrendingUp, TrendingDown,
  Code2, ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { assessmentApi, learningApi } from "@/lib/api";
import type { AssessmentQuestion, AssessmentResult } from "@/types";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";

type PageState = "code_input" | "analyzing" | "quiz" | "completing" | "building_space" | "results";

interface AnswerFeedback {
  is_correct: boolean;
  correct_answer: string;
  explanation?: string;
}

/** Replace literal \n and \t escape sequences the LLM sometimes emits */
const unescape = (s: string) =>
  s.replace(/\\n/g, "\n").replace(/\\t/g, "    ");

const PLACEHOLDER_CODE = `# Paste any code you want to understand
# For example:

def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

print(bubble_sort([64, 34, 25, 12, 22, 11, 90]))`;

export default function Assessment() {
  const navigate = useNavigate();
  const { updateUser } = useAuthStore();

  const [pageState, setPageState] = useState<PageState>("code_input");
  const [codeInput, setCodeInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [codeLanguage, setCodeLanguage] = useState("");
  const [codeSummary, setCodeSummary] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  // ── Step 1: Submit code ──────────────────────────────────────────────────
  const handleSubmitCode = useCallback(async () => {
    const code = codeInput.trim();
    if (code.length < 10) {
      toast.error("Please paste at least a few lines of code.");
      return;
    }
    setPageState("analyzing");
    try {
      const res = await assessmentApi.start(code);
      const { session_id, questions: qs, code_analysis } = res.data;
      setSessionId(session_id);
      setQuestions(qs);
      setCodeLanguage(code_analysis.language);
      setCodeSummary(code_analysis.summary);
      setPageState("quiz");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((e: { msg?: string }) => e.msg).join(", ")
        : (detail as string) ?? "Failed to analyze code. Please try again.";
      toast.error(msg);
      setPageState("code_input");
    }
  }, [codeInput]);

  // ── Step 2: Answer question ───────────────────────────────────────────────
  const handleSelectOption = async (key: string) => {
    if (selectedKey !== null || submittingAnswer) return;
    setSelectedKey(key);
    setSubmittingAnswer(true);
    try {
      const res = await assessmentApi.submitAnswer({
        session_id: sessionId,
        question_id: questions[currentIndex].id,
        answer_key: key,
      });
      setFeedback(res.data);
    } catch {
      setFeedback({ is_correct: false, correct_answer: key });
    } finally {
      setSubmittingAnswer(false);
    }
  };

  // ── Step 3: Next question / complete ─────────────────────────────────────
  const handleNext = async () => {
    if (currentIndex >= questions.length - 1) {
      setPageState("completing");
      try {
        const res = await assessmentApi.complete(sessionId);
        setResult(res.data);
        updateUser({
          assessment_completed: true,
          skill_level: res.data.skill_level as "beginner" | "intermediate" | "advanced",
        });
        // Auto-generate the learning space + path without requiring an extra button click
        setPageState("building_space");
        await learningApi.generatePath();
        toast.success("Learning space created!");
        navigate("/dashboard");
      } catch {
        toast.error("Something went wrong. Please try again.");
        setPageState("quiz");
      }
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedKey(null);
      setFeedback(null);
    }
  };

  // ── Analyzing spinner ────────────────────────────────────────────────────
  if (pageState === "analyzing") {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
          <p className="text-lg font-medium text-slate-200">Analyzing your code…</p>
          <p className="text-sm text-slate-500">AI is reading your code and generating 10 personalized questions</p>
        </div>
      </div>
    );
  }

  // ── Completing / building spinners ────────────────────────────────────────
  if (pageState === "completing") {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-fuchsia-400" />
          <p className="text-lg font-medium text-slate-200">Scoring your results…</p>
        </div>
      </div>
    );
  }

  if (pageState === "building_space") {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
          <p className="text-lg font-medium text-slate-200">Building your learning space…</p>
          <p className="text-sm text-slate-500">Generating a personalized path just for you</p>
        </div>
      </div>
    );
  }

  // ── Code input ────────────────────────────────────────────────────────────
  if (pageState === "code_input") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/15">
            <Code2 className="h-7 w-7 text-sky-400" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-slate-100">Paste Your Code</h1>
          <p className="text-slate-400">
            Share code you found, copied, or wrote — but don't fully understand.
            We'll generate 10 questions specifically about <em>your</em> code.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Code Snippet</CardTitle>
            <CardDescription>Any language · Any length · Doesn't need to run perfectly</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder={PLACEHOLDER_CODE}
              rows={14}
              spellCheck={false}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 font-mono text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none"
            />
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={handleSubmitCode}
              disabled={codeInput.trim().length < 10}
            >
              Analyze My Code
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────
  if (pageState === "results" && result) {
    const skillVariant =
      result.skill_level === "advanced" ? "success"
      : result.skill_level === "intermediate" ? "warning"
      : "secondary";

    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-slate-100">Assessment Complete!</h1>
          <p className="text-slate-400">Here's what we learned about your understanding.</p>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6 space-y-6">
            {/* Score */}
            <div className="flex flex-col items-center">
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-sky-500/30 bg-sky-500/10">
                <span className="text-4xl font-extrabold text-sky-400">{result.score}</span>
                <span className="absolute bottom-6 text-sm font-medium text-sky-300">%</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-slate-400 text-sm">Skill level:</span>
                <Badge variant={skillVariant} className="capitalize">{result.skill_level}</Badge>
              </div>
            </div>

            {result.strong_areas.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-400">
                  <TrendingUp className="h-4 w-4" /> Strong Areas
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.strong_areas.map((a) => (
                    <span key={a} className="rounded-full bg-emerald-500/15 border border-emerald-500/25 px-3 py-1 text-xs font-medium text-emerald-400">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {result.weak_areas.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-red-400">
                  <TrendingDown className="h-4 w-4" /> Areas to Improve
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.weak_areas.map((a) => (
                    <span key={a} className="rounded-full bg-red-500/15 border border-red-500/25 px-3 py-1 text-xs font-medium text-red-400">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {result.recommendation && (
              <div className="rounded-xl border border-slate-600 bg-slate-700/50 p-4 text-sm text-slate-300 leading-relaxed">
                {result.recommendation}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    );
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────
  const question = questions[currentIndex];
  const progress = (currentIndex / questions.length) * 100;

  const optionStyle = (key: string) => {
    if (!feedback) {
      return selectedKey === key
        ? "border-sky-500 bg-sky-500/10 text-slate-100"
        : "border-slate-600 hover:border-slate-500 hover:bg-slate-700/50 text-slate-300 cursor-pointer";
    }
    if (key === feedback.correct_answer) return "border-emerald-500 bg-emerald-500/10 text-emerald-300";
    if (key === selectedKey && !feedback.is_correct) return "border-red-500 bg-red-500/10 text-red-300";
    return "border-slate-700 text-slate-500 opacity-50";
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-300">Question {currentIndex + 1} of {questions.length}</span>
          <span className="text-slate-500 capitalize">{codeLanguage} · {question?.topic}</span>
        </div>
        <ProgressBar value={progress} />
        {codeSummary && (
          <p className="mt-2 text-xs text-slate-500 italic">About your code: {codeSummary}</p>
        )}
      </div>

      {/* Question */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg font-normal leading-relaxed text-slate-100 whitespace-pre-wrap">
            {unescape(question?.question ?? "")}
          </CardTitle>
          {question?.code_reference && (
            <p className="text-xs text-slate-500">Reference: {question.code_reference}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {question?.options.map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleSelectOption(opt.key)}
                disabled={!!selectedKey || submittingAnswer}
                className={`w-full rounded-xl border px-4 py-3.5 text-left text-sm transition-all flex items-start gap-3 ${optionStyle(opt.key)}`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold mt-0.5">
                  {opt.key}
                </span>
                <span className="whitespace-pre-wrap">{unescape(opt.text)}</span>
                {feedback && opt.key === feedback.correct_answer && (
                  <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                )}
                {feedback && opt.key === selectedKey && !feedback.is_correct && opt.key !== feedback.correct_answer && (
                  <XCircle className="ml-auto h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                )}
              </button>
            ))}
          </div>

          {feedback && (
            <div className={`mt-4 rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
              feedback.is_correct
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-300"
            }`}>
              {feedback.is_correct
                ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
              <span>
                {feedback.is_correct
                  ? "Correct!"
                  : `Incorrect — correct answer was ${feedback.correct_answer}.`}
                {feedback.explanation && ` ${feedback.explanation}`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {feedback && (
        <Button size="lg" className="w-full" onClick={handleNext}>
          {currentIndex >= questions.length - 1 ? "See Results" : "Next Question →"}
        </Button>
      )}
    </div>
  );
}
