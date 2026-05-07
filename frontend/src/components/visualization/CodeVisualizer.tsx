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

function normalizeState(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  if (Array.isArray(raw)) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

function ValueBadge({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="font-mono text-slate-500 italic">None</span>;
  }
  if (typeof value === "boolean") {
    return (
      <span className={cn("font-mono font-medium", value ? "text-emerald-400" : "text-rose-400")}>
        {String(value)}
      </span>
    );
  }
  if (typeof value === "number") {
    return <span className="font-mono text-amber-300">{String(value)}</span>;
  }
  if (typeof value === "string") {
    return <span className="font-mono text-sky-300">"{value}"</span>;
  }
  return <span className="font-mono text-slate-300">{JSON.stringify(value)}</span>;
}

export default function CodeVisualizer({ title, code, steps }: CodeVisualizerProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!steps || steps.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-6 text-center text-slate-500 text-sm">
        No visualization steps available.
      </div>
    );
  }

  const step = steps[currentStep];
  const codeLines = code.split("\n");
  const stateObj = normalizeState(step.state);
  const stateEntries = Object.entries(stateObj).filter(([k]) => k !== "line");
  const highlightedLine =
    typeof step.step === "number"
      ? step.step
      : typeof stateObj["line"] === "number"
      ? (stateObj["line"] as number)
      : null;

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-700/60 bg-slate-900/80 px-5 py-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <span className="text-xs text-slate-600">
          {currentStep + 1} / {steps.length}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Code block */}
        <div className="rounded-xl overflow-hidden border border-slate-700/60">
          <div className="bg-slate-900 px-4 py-2 text-xs text-slate-600 border-b border-slate-700/60 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-2 w-2 rounded-full bg-red-500/50" />
              <div className="h-2 w-2 rounded-full bg-yellow-500/50" />
              <div className="h-2 w-2 rounded-full bg-emerald-500/50" />
            </div>
            code
          </div>
          <pre className="overflow-x-auto bg-slate-950 text-sm font-mono leading-6">
            {codeLines.map((line, idx) => {
              const lineNum = idx + 1;
              const active = highlightedLine === lineNum;
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start px-4 py-0.5 transition-colors duration-200",
                    active
                      ? "bg-sky-500/10 border-l-2 border-sky-500"
                      : "border-l-2 border-transparent"
                  )}
                >
                  <span className="mr-4 select-none w-5 text-right text-slate-700 shrink-0 text-xs pt-0.5">
                    {lineNum}
                  </span>
                  <span className={active ? "text-slate-100" : "text-slate-400"}>
                    {line || " "}
                  </span>
                </div>
              );
            })}
          </pre>
        </div>

        {/* Step description */}
        <div className="flex gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-400">
            {currentStep + 1}
          </span>
          <p className="text-sm leading-relaxed text-sky-200">{step.description}</p>
        </div>

        {/* Variable state */}
        {stateEntries.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
              Variable state
            </p>
            <div className="rounded-xl border border-slate-700/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/60 bg-slate-900/60">
                    <th className="py-2 pl-4 pr-3 text-left text-xs font-medium text-slate-600">
                      Variable
                    </th>
                    <th className="py-2 pl-3 pr-4 text-left text-xs font-medium text-slate-600">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {stateEntries.map(([key, value]) => (
                    <tr key={key} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 pl-4 pr-3 font-mono text-fuchsia-300 text-sm">
                        {key}
                      </td>
                      <td className="py-2.5 pl-3 pr-4">
                        <ValueBadge value={value} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step navigation */}
        <div className="flex items-center justify-between pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentStep((i) => Math.max(0, i - 1))}
            disabled={currentStep === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </Button>

          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  i === currentStep
                    ? "w-5 bg-sky-500"
                    : "w-1.5 bg-slate-700 hover:bg-slate-500"
                )}
              />
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentStep((i) => Math.min(steps.length - 1, i + 1))}
            disabled={currentStep === steps.length - 1}
            className="gap-1"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
