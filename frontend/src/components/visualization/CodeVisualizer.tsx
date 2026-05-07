import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { VisualizationStep } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CodeVisualizerProps {
  title: string;
  code: string;
  steps: VisualizationStep[];
}

export default function CodeVisualizer({ title, code, steps }: CodeVisualizerProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!steps || steps.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 text-center text-slate-400">
        No visualization steps available.
      </div>
    );
  }

  const step = steps[currentStep];
  const codeLines = code.split("\n");

  const goBack = () => setCurrentStep((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentStep((i) => Math.min(steps.length - 1, i + 1));

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-700 px-5 py-3">
        <h3 className="font-semibold text-slate-100">{title}</h3>
      </div>

      <div className="p-5 space-y-5">
        {/* Code block with line highlighting */}
        <div className="rounded-lg overflow-hidden border border-slate-700">
          <div className="bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-500 border-b border-slate-700 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
            </div>
            code
          </div>
          <pre className="overflow-x-auto bg-slate-950 text-sm font-mono leading-6">
            {codeLines.map((line, idx) => {
              const lineNum = idx + 1;
              const isHighlighted =
                step.step === lineNum ||
                (step.state["line"] !== undefined && step.state["line"] === lineNum);
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start px-4 py-0.5 transition-colors",
                    isHighlighted && "bg-sky-500/10 border-l-2 border-sky-500"
                  )}
                >
                  <span className="mr-4 select-none w-5 text-right text-slate-600 shrink-0">
                    {lineNum}
                  </span>
                  <span className={isHighlighted ? "text-slate-100" : "text-slate-400"}>
                    {line || " "}
                  </span>
                </div>
              );
            })}
          </pre>
        </div>

        {/* Step description */}
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-3">
          <p className="text-sm leading-relaxed text-sky-300">{step.description}</p>
        </div>

        {/* Variable state table */}
        {Object.keys(step.state).length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Variable State
            </h4>
            <div className="overflow-hidden rounded-lg border border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    <th className="py-2 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Variable
                    </th>
                    <th className="py-2 pl-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {Object.entries(step.state).map(([key, value]) => (
                    <tr
                      key={key}
                      className="transition-colors hover:bg-slate-700/30"
                    >
                      <td className="py-2 pl-4 pr-3 font-mono text-fuchsia-300">
                        {key}
                      </td>
                      <td className="py-2 pl-3 pr-4 font-mono text-sky-300">
                        {JSON.stringify(value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={goBack}
            disabled={currentStep === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>

          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-slate-500">
              Step {currentStep + 1} of {steps.length}
            </span>
            {/* Dot navigation */}
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200",
                    i === currentStep
                      ? "w-4 bg-sky-500"
                      : "w-1.5 bg-slate-600 hover:bg-slate-500"
                  )}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={currentStep === steps.length - 1}
            className="gap-1"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
