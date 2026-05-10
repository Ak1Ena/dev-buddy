import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Loader2, Wrench } from "lucide-react";
import toast from "react-hot-toast";
import { learningApi } from "@/lib/api";
import type { Lesson } from "@/types";
import { Badge } from "@/components/ui/badge";
import WorkshopExercise from "@/components/lesson/WorkshopExercise";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { topicLabel } from "@/lib/utils";

export default function Workshop() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lessonId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await learningApi.getLesson(lessonId);
        setLesson(res.data);
      } catch {
        toast.error("Failed to load workshop.");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [lessonId, navigate]);

  const handleComplete = async (score: number) => {
    if (!lessonId) return;
    try {
      await learningApi.updateProgress(lessonId, {
        workshop_score: score,
        status: score > 0 ? "completed" : "in_progress",
      });
      if (score > 0) toast.success(`Workshop complete! Score: ${score}/100`);
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-950 mesh-gradient">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-emerald-400 animate-spin" />
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Loading workshop…</p>
        </div>
      </div>
    );
  }

  if (!lesson) return null;

  const workshop = lesson.content?.workshops?.[0];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 mesh-gradient">
      <ErrorBoundary>
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(`/learn/${lessonId}`)}
              className="group flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-400 transition-all"
            >
              <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back to Lesson
            </button>
            <Badge variant="outline" className="text-[9px] h-5 px-2 border-emerald-500/30 text-emerald-400 font-bold uppercase tracking-tighter">
              {topicLabel(lesson.topic)}
            </Badge>
          </div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/30 text-emerald-400">
                <Wrench className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-500">Mastery Challenge</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{lesson.title}</h1>
            <p className="text-sm text-slate-400 font-medium">Apply what you learned — no need to run the code, think it through.</p>
          </motion.div>

          {/* Workshop */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 md:p-8 shadow-[0_0_40px_rgba(16,185,129,0.05)]"
          >
            {workshop ? (
              <WorkshopExercise workshop={workshop} onComplete={handleComplete} />
            ) : (
              <div className="text-center py-10 space-y-3">
                <p className="text-slate-400 font-medium">No workshop is available for this lesson yet.</p>
                <button
                  onClick={() => navigate(`/learn/${lessonId}`)}
                  className="text-sm font-bold text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
                >
                  Return to the lesson
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </ErrorBoundary>
    </div>
  );
}
