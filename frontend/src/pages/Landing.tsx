import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Monitor, Code2, ArrowRight, CheckCircle } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const features = [
  {
    icon: Brain,
    title: "Socratic AI Mentor",
    description:
      "Our AI never gives you the answer directly. Instead, it asks guiding questions that help you discover solutions yourself — building deep understanding.",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    icon: Monitor,
    title: "Runtime Visualizer",
    description:
      "Watch your code execute step-by-step. See variables change, loops iterate, and functions call — making abstract concepts concrete.",
    color: "text-fuchsia-400",
    bg: "bg-fuchsia-500/10",
  },
  {
    icon: Code2,
    title: "Interactive Workshops",
    description:
      "Predict outputs, fill in blanks, debug challenges. Hands-on exercises with smart hints that keep you learning without spoiling the solution.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
];

const steps = [
  {
    number: "01",
    title: "Take the Assessment",
    description:
      "A short 10-question quiz calibrates your current knowledge — no pressure, just context for your AI mentor.",
  },
  {
    number: "02",
    title: "Get Your Path",
    description:
      "Based on your results, we generate a personalized lesson sequence targeting exactly what you need to learn.",
  },
  {
    number: "03",
    title: "Learn Interactively",
    description:
      "Work through lessons with live code examples, visualizations, and an AI tutor available 24/7 to guide you.",
  },
];

export default function Landing() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="relative overflow-hidden bg-slate-900">
      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-80 right-0 h-[400px] w-[400px] rounded-full bg-fuchsia-500/8 blur-3xl" />

      {/* ── HERO ── */}
      <section className="relative mx-auto max-w-7xl px-4 pb-24 pt-20 text-center sm:px-6 lg:px-8 lg:pt-32">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center"
        >
          <motion.div variants={fadeInUp}>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-sm font-medium text-sky-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
              </span>
              Powered by Socratic Learning
            </span>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="mb-6 max-w-4xl text-5xl font-extrabold leading-tight tracking-tight text-slate-100 sm:text-6xl lg:text-7xl"
          >
            The Mentor for{" "}
            <span className="bg-gradient-to-r from-sky-400 via-fuchsia-400 to-sky-400 bg-clip-text text-transparent">
              Self-Taught Developers.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="mb-10 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl"
          >
            devBuddy is the AI-powered senior developer you’ve been missing. 
            Build deep mental models through Socratic dialogue and 
            interactive logic maps—designed for independent learners.
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate("/register")}
              className="group gap-2 px-8 text-base"
            >
              Start Learning Free
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/assessment")}
              className="px-8 text-base"
            >
              Take the Assessment
            </Button>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500"
          >
            {["No credit card required", "Free to start", "10-min assessment"].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                {item}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <motion.div variants={fadeInUp} className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold text-slate-100 sm:text-4xl">
              Everything you need to learn properly
            </h2>
            <p className="text-slate-400">
              Tools designed for deep understanding, not quick fixes.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div key={feature.title} variants={fadeInUp}>
                  <Card className="h-full transition-all duration-300 hover:border-slate-600 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/50">
                    <CardHeader>
                      <div className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.bg}`}>
                        <Icon className={`h-6 w-6 ${feature.color}`} />
                      </div>
                      <CardTitle>{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="relative bg-slate-800/40 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            <motion.div variants={fadeInUp} className="mb-12 text-center">
              <h2 className="mb-3 text-3xl font-bold text-slate-100 sm:text-4xl">
                How it works
              </h2>
              <p className="text-slate-400">
                From zero to coding confidence in three steps.
              </p>
            </motion.div>

            <div className="grid gap-8 sm:grid-cols-3">
              {steps.map((step, i) => (
                <motion.div
                  key={step.number}
                  variants={fadeInUp}
                  className="relative flex flex-col items-center text-center"
                >
                  {i < steps.length - 1 && (
                    <div className="absolute left-[calc(50%+3rem)] top-8 hidden h-0.5 w-[calc(100%-6rem)] bg-gradient-to-r from-slate-600 to-transparent sm:block" />
                  )}
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-500/30 bg-sky-500/10 text-2xl font-extrabold text-sky-400">
                    {step.number}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-100">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-400">
                    {step.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.h2
              variants={fadeInUp}
              className="mb-4 text-3xl font-bold text-slate-100 sm:text-4xl"
            >
              Ready to learn the right way?
            </motion.h2>
            <motion.p variants={fadeInUp} className="mb-8 text-slate-400">
              Join learners who are building real understanding through Socratic
              dialogue, not copy-paste.
            </motion.p>
            <motion.div variants={fadeInUp} className="flex flex-wrap justify-center gap-4">
              <Button size="lg" onClick={() => navigate("/register")} className="px-10">
                Get Started Free
              </Button>
              <Button size="lg" variant="ghost" onClick={() => navigate("/login")}>
                Sign In
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-600">
        &copy; {new Date().getFullYear()} devBuddy AI — Learn to code through questions.
      </footer>
    </div>
  );
}
