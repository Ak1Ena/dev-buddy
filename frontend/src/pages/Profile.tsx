import { useState, useEffect } from "react";
import { User, TrendingUp, TrendingDown, Calendar, Star, AlertTriangle, BarChart2 } from "lucide-react";
import { authApi, analyticsApi } from "@/lib/api";

interface UserProfile {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  skill_level: string;
  preferred_language: string;
  assessment_completed: boolean;
  assessment_score: number | null;
  weak_areas: string[] | null;
  strong_areas: string[] | null;
  created_at: string;
}

interface SkillSnapshot {
  id: string;
  trigger: string;
  skill_level: string;
  assessment_score: number | null;
  weak_areas: string[] | null;
  strong_areas: string[] | null;
  recorded_at: string;
}

interface Analytics {
  lessons_completed: number;
  lessons_total: number;
  concept_retention_score: number;
  hint_dependency_rate: number;
  skill_progression: SkillSnapshot[];
}

const SKILL_COLORS: Record<string, string> = {
  beginner: "text-sky-400 bg-sky-500/15 border-sky-500/30",
  intermediate: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  advanced: "text-violet-400 bg-violet-500/15 border-violet-500/30",
};

function AreaTag({ label, variant }: { label: string; variant: "weak" | "strong" }) {
  const cls =
    variant === "weak"
      ? "bg-red-500/10 text-red-400 border border-red-500/20"
      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${cls}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([authApi.me(), analyticsApi.me()])
      .then(([userRes, analyticsRes]) => {
        setProfile(userRes.data);
        setAnalytics(analyticsRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  if (!profile) return null;

  const skillClass = SKILL_COLORS[profile.skill_level] ?? SKILL_COLORS.beginner;
  const retentionPct = analytics ? Math.round(analytics.concept_retention_score * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-2xl font-bold text-slate-100">My Profile</h1>

      {/* User info card */}
      <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-800 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-700">
            <User className="h-7 w-7 text-slate-300" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-100">
              {profile.full_name ?? profile.username}
            </p>
            <p className="text-sm text-slate-400">@{profile.username}</p>
            <p className="text-sm text-slate-500">{profile.email}</p>
          </div>
          <div className="ml-auto text-right">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${skillClass}`}>
              {profile.skill_level}
            </span>
            <p className="mt-1 flex items-center justify-end gap-1 text-xs text-slate-500">
              <Calendar className="h-3 w-3" />
              {new Date(profile.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {analytics && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            {
              label: "Latest Score",
              value: profile.assessment_score != null ? `${profile.assessment_score}%` : "—",
              icon: <BarChart2 className="h-4 w-4 text-sky-400" />,
            },
            {
              label: "Lessons Done",
              value: `${analytics.lessons_completed}/${analytics.lessons_total}`,
              icon: <Star className="h-4 w-4 text-yellow-400" />,
            },
            {
              label: "Concept Retention",
              value: `${retentionPct}%`,
              icon: <TrendingUp className="h-4 w-4 text-emerald-400" />,
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-slate-700 bg-slate-800 p-4 text-center"
            >
              <div className="mb-1 flex justify-center">{s.icon}</div>
              <p className="text-xl font-bold text-slate-100">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Weak areas */}
      <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-800 p-6">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <h2 className="font-semibold text-slate-100">Areas to Improve</h2>
          <span className="ml-auto text-xs text-slate-500">accumulated across all assessments</span>
        </div>
        {profile.weak_areas && profile.weak_areas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profile.weak_areas.map((a) => (
              <AreaTag key={a} label={a} variant="weak" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {profile.assessment_completed ? "No weak areas — great work!" : "Complete an assessment to see your weak areas."}
          </p>
        )}
      </div>

      {/* Strong areas */}
      <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-800 p-6">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <h2 className="font-semibold text-slate-100">Strong Areas</h2>
        </div>
        {profile.strong_areas && profile.strong_areas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profile.strong_areas.map((a) => (
              <AreaTag key={a} label={a} variant="strong" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {profile.assessment_completed ? "Keep learning to build your strengths!" : "Complete an assessment to see your strong areas."}
          </p>
        )}
      </div>

      {/* Skill progression history */}
      {analytics && analytics.skill_progression.length > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-sky-400" />
            <h2 className="font-semibold text-slate-100">Assessment History</h2>
          </div>
          <div className="space-y-3">
            {[...analytics.skill_progression].reverse().map((snap, i) => (
              <div
                key={snap.id}
                className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-700/30 px-4 py-3"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-400">
                  {analytics.skill_progression.length - i}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-300 capitalize">{snap.skill_level}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(snap.recorded_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                {snap.assessment_score != null && (
                  <span className="text-sm font-semibold text-sky-400">{snap.assessment_score}%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
