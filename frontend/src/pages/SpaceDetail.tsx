import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle2, PlayCircle, Circle, Clock, Zap,
  FolderOpen, ArrowLeft, Sparkles, Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { learningApi } from "@/lib/api";
import type { SpaceSummary } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { topicLabel } from "@/lib/utils";

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />;
  if (status === "in_progress") return <PlayCircle className="h-5 w-5 text-sky-400 shrink-0" />;
  return <Circle className="h-5 w-5 text-slate-600 shrink-0" />;
}

export default function SpaceDetail() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();

  const [space, setSpace] = useState<SpaceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchSpace = useCallback(async () => {
    try {
      const res = await learningApi.listSpaces();
      const found = (res.data as SpaceSummary[]).find((s) => s.id === spaceId);
      if (!found) { navigate("/dashboard", { replace: true }); return; }
      setSpace(found);
    } catch {
      navigate("/dashboard", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [spaceId, navigate]);

  useEffect(() => {
    fetchSpace();
  }, [fetchSpace]);

  useEffect(() => {
    // Poll every 3s if there's no path yet (for Instant Discovery background tasks)
    let interval: any;
    if (!loading && space && !space.path) {
      interval = setInterval(fetchSpace, 3000);
    }
    return () => clearInterval(interval);
  }, [fetchSpace, loading, !!space, !!space?.path]);

  const handleActivateAndGenerate = async () => {
    if (!space) return;
    setGenerating(true);
    try {
      await learningApi.activateSpace(space.id);
      await learningApi.generatePath();
      toast.success("Learning path generated!");
      await fetchSpace();
    } catch {
      toast.error("Failed to generate path.");
    } finally {
      setGenerating(false);
    }
  };

  const path = space?.path ?? null;
  const completionPercent = path
    ? Math.round((path.completed_lessons / Math.max(path.total_lessons, 1)) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }

  if (!space) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Back + header */}
      <button
        onClick={() => navigate("/dashboard")}
        className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All spaces
      </button>

      <div className="mb-8 flex items-center gap-3">
        <FolderOpen className="h-7 w-7 text-sky-400" />
        <h1 className="text-2xl font-bold text-slate-100">{space.name}</h1>
      </div>

      {!path ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 py-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10">
            {space.is_active ? (
              <Loader2 className="h-7 w-7 animate-spin text-sky-400" />
            ) : (
              <Sparkles className="h-7 w-7 text-sky-400" />
            )}
          </div>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">
            {space.is_active ? "Forging Your Mastery Path..." : "No learning path yet"}
          </h2>
          <p className="mb-6 text-sm text-slate-400 px-8">
            {space.is_active 
              ? "Our agents are analyzing your code and structuring a cinematic logic topology. This usually takes a few moments."
              : "Generate a personalized path for this space."}
          </p>
          {!space.is_active && (
            <Button loading={generating} onClick={handleActivateAndGenerate} className="mx-auto gap-2">
              <Sparkles className="h-4 w-4" />
              Generate Path
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Path summary */}
          <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium text-slate-100">{path.title}</span>
              <span className="text-sm text-slate-400">{completionPercent}% complete</span>
            </div>
            {path.description && (
              <p className="mb-3 text-sm text-slate-400">{path.description}</p>
            )}
            <ProgressBar value={completionPercent} />
            <div className="mt-2 flex gap-3 text-xs text-slate-500">
              <span className="capitalize">{path.language}</span>
              <span>·</span>
              <span className="capitalize">{path.skill_level}</span>
              <span>·</span>
              <span>{path.completed_lessons}/{path.total_lessons} lessons</span>
            </div>
          </div>

          {/* Lessons */}
          <div className="space-y-3">
            {path.lessons.map((lesson) => {
              const status = lesson.progress?.status ?? "not_started";
              return (
                <button
                  key={lesson.id}
                  onClick={() => navigate(`/learn/${lesson.id}`)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-5 py-4 text-left transition-all duration-200 hover:border-slate-600 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-sm font-bold text-slate-300">
                      {lesson.order_index}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-100 truncate">{lesson.title}</span>
                        <Badge variant="secondary" className="shrink-0">{topicLabel(lesson.topic)}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="capitalize">{lesson.difficulty}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {lesson.estimated_minutes} min
                        </span>
                        {!lesson.content && (
                          <span className="flex items-center gap-1 text-amber-500/70">
                            <Zap className="h-3 w-3 animate-pulse" />
                            Preparing…
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusIcon status={status} />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
