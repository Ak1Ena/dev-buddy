import { useState } from "react";
import { CheckCircle2, XCircle, Lightbulb, ChevronRight, RefreshCw } from "lucide-react";
import type { Workshop } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface WorkshopExerciseProps {
  workshop: Workshop;
  onComplete: (score: number) => void;
}

const typeLabels: Record<Workshop["type"], string> = {
  predict_output: "Predict Output",
  fill_in_blank: "Fill in the Blank",
  debug_challenge: "Debug Challenge",
  multiple_choice: "Multiple Choice",
};

export default function WorkshopExercise({ workshop, onComplete }: WorkshopExerciseProps) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [shownHints, setShownHints] = useState<string[]>([]);

  const computeScore = (hints: number) => {
    if (hints === 0) return 100;
    if (hints === 1) return 66;
    if (hints === 2) return 33;
    return 0;
  };

  const handleGetHint = () => {
    if (hintsUsed >= workshop.hints.length) return;
    const nextHint = workshop.hints[hintsUsed];
    setShownHints((prev) => [...prev, nextHint]);
    setHintsUsed((h) => h + 1);
  };

  const handleSubmit = () => {
    if (!answer.trim()) return;
    const correct =
      answer.trim().toLowerCase() === workshop.answer.trim().toLowerCase();
    setIsCorrect(correct);
    setSubmitted(true);
    const score = correct ? computeScore(hintsUsed) : 0;
    onComplete(score);
  };

  const typeVariantMap: Record<Workshop["type"], "default" | "warning" | "danger" | "secondary"> = {
    predict_output: "default",
    fill_in_blank: "warning",
    debug_challenge: "danger",
    multiple_choice: "secondary",
  };

  return (
    <div className="space-y-5">
      {/* Type badge + title */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={typeVariantMap[workshop.type]}>
          {typeLabels[workshop.type]}
        </Badge>
        <h3 className="font-semibold text-slate-100">{workshop.title}</h3>
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed text-slate-300">{workshop.description}</p>

      {/* Code block */}
      {workshop.code && (
        <div className="overflow-hidden rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-900/60 px-3 py-2">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
            </div>
            <span className="text-xs text-slate-500">code</span>
          </div>
          <pre className="overflow-x-auto bg-slate-950 p-4 text-sm font-mono leading-6 text-slate-300">
            <code>{workshop.code}</code>
          </pre>
        </div>
      )}

      {/* Shown hints */}
      {shownHints.length > 0 && (
        <div className="space-y-2">
          {shownHints.map((hint, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/8 px-4 py-3"
            >
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
              <div>
                <span className="text-xs font-semibold text-yellow-400">
                  Hint {i + 1}:
                </span>
                <p className="mt-0.5 text-sm text-yellow-200/80">{hint}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Answer input */}
      {!submitted && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">
            Your Answer
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer here…"
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-600 bg-slate-700/50 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>
      )}

      {/* Action buttons */}
      {!submitted && (
        <div className="flex items-center gap-3">
          <Button onClick={handleSubmit} disabled={!answer.trim()} className="gap-1.5">
            Submit
            <ChevronRight className="h-4 w-4" />
          </Button>
          {hintsUsed < workshop.hints.length && (
            <Button
              variant="outline"
              onClick={handleGetHint}
              className="gap-1.5"
            >
              <Lightbulb className="h-4 w-4" />
              Get a Hint
              {hintsUsed > 0 && (
                <span className="text-xs opacity-70">
                  ({hintsUsed}/{workshop.hints.length})
                </span>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Feedback */}
      {submitted && (
        <div
          className={`rounded-xl border px-5 py-4 ${
            isCorrect
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-red-500/30 bg-red-500/10"
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            {isCorrect ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <span className="font-semibold text-emerald-300">
                  Correct! Score: {computeScore(hintsUsed)} points
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-400" />
                <span className="font-semibold text-red-300">Not quite right — keep going!</span>
              </>
            )}
          </div>

          {/* Correct: show full explanation */}
          {isCorrect && workshop.explanation && (
            <p className="text-sm leading-relaxed text-slate-300">
              {workshop.explanation}
            </p>
          )}

          {/* Wrong: never reveal the answer — offer hint or retry */}
          {!isCorrect && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-slate-400">Would you like a hint, or do you want to try again?</p>
              <div className="flex items-center gap-2.5 flex-wrap">
                {hintsUsed < workshop.hints.length && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleGetHint();
                      setSubmitted(false);
                      setAnswer("");
                    }}
                    className="gap-1.5"
                  >
                    <Lightbulb className="h-4 w-4" />
                    Give me a hint
                    <span className="text-xs opacity-60">({hintsUsed}/{workshop.hints.length})</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => { setSubmitted(false); setAnswer(""); }}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try again
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
