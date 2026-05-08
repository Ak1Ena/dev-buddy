import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderOpen, Plus, Loader2, BookOpen, CheckCircle2, Sparkles,
} from "lucide-react";
import { learningApi } from "@/lib/api";
import type { SpaceSummary } from "@/types";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

function SpaceCard({ space, onClick }: { space: SpaceSummary; onClick: () => void }) {
  const path = space.path;
  const percent = path
    ? Math.round((path.completed_lessons / Math.max(path.total_lessons, 1)) * 100)
    : 0;

  const langColor: Record<string, string> = {
    python: "bg-sky-500/15 text-sky-400 border-sky-500/25",
    javascript: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
    typescript: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    java: "bg-orange-500/15 text-orange-400 border-orange-500/25",
    go: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  };
  const langClass = path
    ? langColor[path.language.toLowerCase()] ?? "bg-slate-500/15 text-slate-400 border-slate-500/25"
    : "bg-slate-500/15 text-slate-400 border-slate-500/25";

  return (
    <button
      onClick={onClick}
      className="group relative w-full rounded-2xl border border-slate-700 bg-slate-800 p-5 text-left transition-all duration-200 hover:border-slate-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      {space.is_active && (
        <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_6px_2px_rgba(56,189,248,0.4)]" />
      )}

      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-700 transition-colors group-hover:bg-slate-600">
          <FolderOpen className="h-5 w-5 text-slate-300" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-100">{space.name}</p>
          <p className="text-xs text-slate-500">
            {new Date(space.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>

      {path ? (
        <>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${langClass}`}>
              {path.language}
            </span>
            <span className="text-slate-500">{percent}%</span>
          </div>
          <ProgressBar value={percent} />
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {path.completed_lessons}/{path.total_lessons} lessons
            </span>
            <span className="capitalize">{path.skill_level}</span>
          </div>
        </>
      ) : (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          No path yet — click to generate
        </div>
      )}
    </button>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSpaces = useCallback(async () => {
    try {
      const res = await learningApi.listSpaces();
      setSpaces(res.data ?? []);
    } catch {
      setSpaces([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && !user.assessment_completed) {
      navigate("/assessment", { replace: true });
      return;
    }
    fetchSpaces();
  }, [user, navigate, fetchSpaces]);

  const totalCompleted = spaces.reduce((sum, s) => sum + (s.path?.completed_lessons ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">
            Welcome back, {user?.username}!
          </h1>
          <p className="mt-1 text-slate-400">
            {spaces.length === 0
              ? "Create your first learning space to get started."
              : `${spaces.length} space${spaces.length !== 1 ? "s" : ""} · ${totalCompleted} lessons completed`}
          </p>
        </div>
        <Button
          onClick={() => navigate("/assessment")}
          size="sm"
          className="shrink-0 gap-2"
        >
          <Plus className="h-4 w-4" />
          New Space
        </Button>
      </div>

      {/* Spaces grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
        </div>
      ) : spaces.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10">
            <BookOpen className="h-8 w-8 text-sky-400" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-slate-100">No learning spaces yet</h2>
          <p className="mb-6 text-slate-400">
            Paste any code you want to understand and we'll build a personalized learning path for it.
          </p>
          <Button onClick={() => navigate("/assessment")} size="lg" className="mx-auto gap-2">
            <Plus className="h-4 w-4" />
            Create First Space
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <SpaceCard
              key={space.id}
              space={space}
              onClick={() => navigate(`/space/${space.id}`)}
            />
          ))}

          {/* Add new space card */}
          <button
            onClick={() => navigate("/assessment")}
            className="flex min-h-[160px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-700 text-slate-500 transition-all duration-200 hover:border-sky-500/50 hover:text-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <Plus className="h-7 w-7" />
            <span className="text-sm font-medium">New Learning Space</span>
          </button>
        </div>
      )}
    </div>
  );
}
