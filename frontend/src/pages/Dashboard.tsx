import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  PlayCircle,
  Circle,
  Clock,
  Flame,
  BookOpen,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { learningApi } from "@/lib/api";
import type { LearningPath, Lesson } from "@/types";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { topicLabel } from "@/lib/utils";

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-700 bg-slate-800 p-6">
      <div className="mb-3 h-4 w-1/3 rounded bg-slate-700" />
      <div className="mb-2 h-6 w-2/3 rounded bg-slate-700" />
      <div className="h-3 w-1/2 rounded bg-slate-700" />
    </div>
  );
}

function StatusIcon({ status }: { status: Lesson["progress"] extends null ? never : string }) {
  if (status === "completed")
    return <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />;
  if (status === "in_progress")
    return <PlayCircle className="h-5 w-5 text-sky-400 shrink-0" />;
  return <Circle className="h-5 w-5 text-slate-600 shrink-0" />;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [path, setPath] = useState<LearningPath | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchPath = useCallback(async () => {
    try {
      const res = await learningApi.getActivePath();
      setPath(res.data ?? null);
    } catch {
      setPath(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && !user.assessment_completed) {
      navigate("/assessment", { replace: true });
      return;
    }
    fetchPath();
  }, [user, navigate, fetchPath]);

  const handleGeneratePath = async () => {
    setGenerating(true);
    try {
      await learningApi.generatePath();
      toast.success("Learning path generated!");
      await fetchPath();
    } catch {
      toast.error("Failed to generate learning path.");
    } finally {
      setGenerating(false);
    }
  };

  const skillBadgeVariant =
    user?.skill_level === "advanced"
      ? "success"
      : user?.skill_level === "intermediate"
      ? "warning"
      : "secondary";

  const completionPercent = path
    ? Math.round((path.completed_lessons / Math.max(path.total_lessons, 1)) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">
          Welcome back, {user?.username}! 👋
        </h1>
        <p className="mt-1 text-slate-400">
          Keep up the great work. You're making progress every day.
        </p>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 py-4 px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
            <BookOpen className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Lessons Completed
            </p>
            <p className="mt-0.5 text-2xl font-bold text-slate-100">
              {loading ? "—" : `${path?.completed_lessons ?? 0}`}
              <span className="ml-1 text-sm font-normal text-slate-500">
                / {path?.total_lessons ?? "—"}
              </span>
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 py-4 px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
            <Flame className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Current Streak
            </p>
            <p className="mt-0.5 text-2xl font-bold text-slate-100">
              3{" "}
              <span className="text-sm font-normal text-slate-500">days</span>
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 py-4 px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15">
            <Sparkles className="h-5 w-5 text-fuchsia-400" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Skill Level
            </p>
            <div className="mt-1.5">
              <Badge variant={skillBadgeVariant} className="capitalize text-sm">
                {user?.skill_level ?? "beginner"}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Learning Path */}
      {loading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : !path ? (
        /* No path yet */
        <Card className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10">
            <Sparkles className="h-8 w-8 text-sky-400" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-slate-100">
            No Learning Path Yet
          </h2>
          <p className="mb-6 text-slate-400">
            Generate a personalized learning path based on your assessment results.
          </p>
          <Button
            size="lg"
            loading={generating}
            onClick={handleGeneratePath}
            className="mx-auto gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Generate My Learning Path
          </Button>
        </Card>
      ) : (
        /* Path exists */
        <div>
          {/* Path header + progress */}
          <div className="mb-6">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-100">{path.title}</h2>
              <span className="text-sm text-slate-400">{completionPercent}% complete</span>
            </div>
            {path.description && (
              <p className="mb-4 text-sm text-slate-400">{path.description}</p>
            )}
            <ProgressBar value={completionPercent} />
          </div>

          {/* Lesson list */}
          <div className="space-y-3">
            {path.lessons.map((lesson) => {
              const status = lesson.progress?.status ?? "not_started";
              return (
                <button
                  key={lesson.id}
                  onClick={() => navigate(`/learn/${lesson.id}`)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-5 py-4 text-left transition-all duration-200 hover:border-slate-600 hover:bg-slate-750 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <div className="flex items-center gap-4">
                    {/* Order badge */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-sm font-bold text-slate-300">
                      {lesson.order_index}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-100 truncate">
                          {lesson.title}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {topicLabel(lesson.topic)}
                        </Badge>
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

                    {/* Status icon */}
                    <StatusIcon status={status as string} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
