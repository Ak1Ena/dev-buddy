import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, Monitor, Code2, ArrowRight, CheckCircle, 
  Sparkles, Zap, Lock, User, Mail, Loader2 
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { authApi, learningApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import AnalyzingBridge from "@/components/layout/AnalyzingBridge";

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

export default function Landing() {
  const { isAuthenticated, setAuth } = useAuthStore();
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  
  const [regForm, setRegForm] = useState({ email: "", username: "", password: "" });
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");

  useEffect(() => {
    if (isAuthenticated && !isAnalyzing && !code) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate, isAnalyzing, code]);

  const handleVisualize = async () => {
    if (!code.trim()) return;

    if (!isAuthenticated) {
      setShowRegister(true);
      return;
    }

    startDiscovery();
  };

  const startDiscovery = async () => {
    setIsAnalyzing(true);
    try {
      const res = await learningApi.instantDiscovery(code);
      // UX: Ensure bridge is seen for at least 2.5s
      setTimeout(() => {
        navigate(`/space/${res.data.space_id}`);
      }, 2500);
    } catch (err) {
      console.error(err);
      setIsAnalyzing(false);
      alert("Analysis failed. Please try a shorter snippet.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError("");
    try {
      const res = await authApi.register(regForm);
      const { user, access_token, refresh_token } = res.data;
      setAuth(user, access_token, refresh_token);
      setShowRegister(false);
      startDiscovery();
    } catch (err: any) {
      setRegError(err.response?.data?.detail || "Registration failed");
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <AnalyzingBridge isVisible={isAnalyzing} />

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
      <div className="pointer-events-none absolute top-80 right-0 h-[400px] w-[400px] rounded-full bg-fuchsia-500/5 blur-3xl" />

      {/* ── HERO ── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-20 text-center sm:px-6 lg:px-8 lg:pt-32">
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
              Phase 3: Instant Logic Discovery
            </span>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="mb-6 max-w-4xl text-5xl font-extrabold leading-tight tracking-tight text-slate-100 sm:text-6xl lg:text-7xl"
          >
            Paste your code.{" "}
            <span className="bg-gradient-to-r from-sky-400 via-fuchsia-400 to-sky-400 bg-clip-text text-transparent">
              See the logic.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="mb-10 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl"
          >
            Transform raw syntax into cinematic mental models. Instantly.
            Build deep understanding through Socratic mentorship.
          </motion.p>

          <motion.div variants={fadeInUp} className="w-full max-w-3xl">
            <div className="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 shadow-[0_0_50px_-12px_rgba(14,165,233,0.3)] backdrop-blur-xl">
               {/* Editor Header */}
               <div className="flex items-center justify-between border-b border-slate-700/50 bg-slate-800/50 px-4 py-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-slate-700" />
                    <div className="h-3 w-3 rounded-full bg-slate-700" />
                    <div className="h-3 w-3 rounded-full bg-slate-700" />
                  </div>
                  <span className="text-xs font-mono text-slate-500">logic_forge.js</span>
               </div>

               {/* Editor Textarea */}
               <div className="relative h-96">
                  <textarea
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="// Paste your code here to visualize its logic topology..."
                    className="h-full w-full resize-none bg-transparent p-6 font-mono text-sm leading-relaxed text-slate-300 outline-none placeholder:text-slate-600"
                    spellCheck={false}
                  />
                  
                  {/* Action Button */}
                  <div className="absolute bottom-6 right-6">
                    <Button
                      size="lg"
                      onClick={handleVisualize}
                      disabled={!code.trim()}
                      className="group relative overflow-hidden bg-gradient-to-r from-sky-600 to-sky-500 px-8 font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-sky-500/20 active:scale-95 disabled:opacity-50"
                    >
                      <Zap className="mr-2 h-4 w-4 fill-white" />
                      Visualize Logic
                      <div className="absolute inset-0 -z-10 bg-sky-400 opacity-0 transition-opacity group-hover:opacity-10 animate-pulse" />
                    </Button>
                  </div>
               </div>
            </div>
            
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
              {["No signup required for preview", "Supports 15+ Languages", "Cinematic Logic Maps"].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  {item}
                </span>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <motion.div variants={fadeInUp} className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold text-slate-100 sm:text-4xl">
              Learn code like a Senior Developer
            </h2>
            <p className="text-slate-400">
              Tools designed for deep mental models, not copy-paste.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div key={feature.title} variants={fadeInUp}>
                  <Card className="h-full border-slate-800 bg-slate-900/50 backdrop-blur-sm transition-all duration-300 hover:border-slate-600 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/50">
                    <CardHeader>
                      <div className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.bg}`}>
                        <Icon className={`h-6 w-6 ${feature.color}`} />
                      </div>
                      <CardTitle className="text-slate-100">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm leading-relaxed text-slate-400">
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

      {/* Quick Register Modal */}
      <AnimatePresence>
        {showRegister && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRegister(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
            >
              <div className="bg-gradient-to-br from-sky-500/10 to-fuchsia-500/10 p-8">
                <h3 className="text-2xl font-bold text-white">Save Your Logic Map</h3>
                <p className="mt-2 text-slate-400">Create an account to see your cinematic walkthrough.</p>
                
                <form onSubmit={handleRegister} className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400">Username</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        required
                        type="text"
                        value={regForm.username}
                        onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2 pl-10 pr-4 text-sm text-white outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50"
                        placeholder="coder_01"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        required
                        type="email"
                        value={regForm.email}
                        onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2 pl-10 pr-4 text-sm text-white outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        required
                        type="password"
                        value={regForm.password}
                        onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2 pl-10 pr-4 text-sm text-white outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {regError && <p className="text-xs text-rose-500">{regError}</p>}

                  <Button type="submit" className="w-full gap-2" disabled={regLoading}>
                    {regLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Unlock Mastery Path
                  </Button>
                </form>
                
                <p className="mt-4 text-center text-xs text-slate-500">
                  Already have an account?{" "}
                  <button onClick={() => navigate("/login")} className="text-sky-400 hover:underline">
                    Sign in
                  </button>
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 py-8 text-center text-sm text-slate-600">
        &copy; {new Date().getFullYear()} devBuddy AI — Learn to code through questions.
      </footer>
    </div>
  );
}
