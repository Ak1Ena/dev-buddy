import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { assessmentApi, learningApi } from "@/lib/api";
import type { AssessmentQuestion, AssessmentResult } from "@/types";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";

type PageState = "loading" | "quiz" | "generating" | "results";

interface AnswerFeedback {
  correct: boolean;
  correct_answer: string;
  explanation?: string;
}

export default function Assessment() {
  const navigate = useNavigate();
  const { updateUser } = useAuthStore();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [sessionId, setSessionId] = useState("");
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [generatingPath, setGeneratingPath] = useState(false);

  const startAssessment = useCallback(async () => {
    setPageState("loading");
    try {
      const res = await assessmentApi.start("python");
      setSessionId(res.data.session_id);
      setQuestions(res.data.questions);
      setPageState("quiz");
    } catch {
      toast.error("Failed to start assessment. Please try again.");
      setPageState("loading");
    }
  }, []);

  useEffect(() => {
    startAssessment();
  }, [startAssessment]);

  const handleSelectOption = async (key: string) => {
    if (selectedKey !== null || submittingAnswer) return;
    setSelectedKey(key);
    setSubmittingAnswer(true);

    const question = questions[currentIndex];
    try {
      const res = await assessmentApi.submitAnswer({
        session_id: sessionId,
        question_id: question.id,
        answer_key: key,
      });
      setFeedback(res.data);
    } catch {
      // Optimistically show selected; no feedback available
      setFeedback({ correct: false, correct_answer: key });
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleNext = async () => {
    const isLast = currentIndex >= questions.length - 1;

    if (isLast) {
      setPageState("generating");
      try {
        const res = await assessmentApi.complete(sessionId);
        setResult(res.data);
        updateUser({ assessment_completed: true, skill_level: res.data.skill_level as "beginner" | "intermediate" | "advanced" });
        setPageState("results");
      } catch {
        toast.error("Failed to complete assessment.");
        setPageState("quiz");
      }
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedKey(null);
      setFeedback(null);
    }
  };

  const handleGeneratePath = async () => {
    setGeneratingPath(true);
    try {
      await learningApi.generatePath("python");
      toast.success("Learning path created!");
      navigate("/dashboard");
    } catch {
      toast.error("Failed to generate learning path.");
    } finally {
      setGeneratingPath(false);
    }
  };

  /* ── Loading spinner ── */
  if (pageState === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
          <p className="text-slate-400">Preparing your assessment…</p>
        </div>
      </div>
    );
  }

  /* ── Generating spinner ── */
  if (pageState === "generating") {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-fuchsia-400" />
          <p className="text-slate-400">Analyzing your results…</p>
        </div>
      </div>
    );
  }

  /* ── Results ── */
  if (pageState === "results" && result) {
    const skillBadgeVariant =
      result.skill_level === "advanced"
        ? "success"
        : result.skill_level === "intermediate"
        ? "warning"
        : "secondary";

    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-slate-100">
            Assessment Complete!
          </h1>
          <p className="text-slate-400">
            Here's a breakdown of your current skill level.
          </p>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            {/* Score circle */}
            <div className="mb-8 flex flex-col items-center">
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-sky-500/30 bg-sky-500/10">
                <span className="text-4xl font-extrabold text-sky-400">
                  {Math.round(result.score)}
                </span>
                <span className="absolute bottom-6 text-sm font-medium text-sky-300">%</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-slate-300 font-medium">Skill Level:</span>
                <Badge variant={skillBadgeVariant} className="capitalize text-sm">
                  {result.skill_level}
                </Badge>
              </div>
            </div>

            {/* Strong areas */}
            {result.strong_areas.length > 0 && (
              <div className="mb-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-400">
                  <TrendingUp className="h-4 w-4" />
                  Strong Areas
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.strong_areas.map((area) => (
                    <span
                      key={area}
                      className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/25"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Weak areas */}
            {result.weak_areas.length > 0 && (
              <div className="mb-6">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-red-400">
                  <TrendingDown className="h-4 w-4" />
                  Areas to Improve
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.weak_areas.map((area) => (
                    <span
                      key={area}
                      className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-400 border border-red-500/25"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendation */}
            {result.recommendation && (
              <div className="rounded-xl border border-slate-600 bg-slate-700/50 p-4">
                <p className="text-sm leading-relaxed text-slate-300">
                  {result.recommendation}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          size="lg"
          className="w-full gap-2"
          loading={generatingPath}
          onClick={handleGeneratePath}
        >
          <Sparkles className="h-4 w-4" />
          Generate My Learning Path
        </Button>
      </div>
    );
  }

  /* ── Quiz ── */
  const question = questions[currentIndex];
  const progress = ((currentIndex) / questions.length) * 100;

  const optionStyle = (key: string) => {
    if (!feedback) {
      return selectedKey === key
        ? "border-sky-500 bg-sky-500/10 text-slate-100"
        : "border-slate-600 hover:border-slate-500 hover:bg-slate-700/50 text-slate-300 cursor-pointer";
    }
    if (key === feedback.correct_answer) {
      return "border-emerald-500 bg-emerald-500/10 text-emerald-300";
    }
    if (key === selectedKey && !feedback.correct) {
      return "border-red-500 bg-red-500/10 text-red-300";
    }
    return "border-slate-700 text-slate-500 opacity-60";
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-300">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-slate-500">{question?.topic}</span>
        </div>
        <ProgressBar value={progress} />
      </div>

      {/* Question card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl leading-relaxed font-normal text-slate-100">
            {question?.question}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {question?.options.map((option) => (
              <button
                key={option.key}
                onClick={() => handleSelectOption(option.key)}
                disabled={!!selectedKey || submittingAnswer}
                className={`w-full rounded-xl border px-4 py-3.5 text-left text-sm transition-all duration-200 flex items-start gap-3 ${optionStyle(option.key)}`}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
                  {option.key.toUpperCase()}
                </span>
                <span>{option.text}</span>
                {feedback && option.key === feedback.correct_answer && (
                  <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                )}
                {feedback && option.key === selectedKey && !feedback.correct && option.key !== feedback.correct_answer && (
                  <XCircle className="ml-auto h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                )}
              </button>
            ))}
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
                feedback.correct
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/30 bg-red-500/10 text-red-300"
              }`}
            >
              {feedback.correct ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <span>
                {feedback.correct
                  ? "Correct! Great job."
                  : `Incorrect. The correct answer was ${feedback.correct_answer.toUpperCase()}.`}
                {feedback.explanation && ` ${feedback.explanation}`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Next button */}
      {feedback && (
        <Button size="lg" className="w-full" onClick={handleNext}>
          {currentIndex >= questions.length - 1 ? "See Results" : "Next Question"}
        </Button>
      )}
    </div>
  );
}
