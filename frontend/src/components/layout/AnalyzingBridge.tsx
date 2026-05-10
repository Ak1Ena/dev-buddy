import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const messages = [
  "Mapping Logic Topologies...",
  "Identifying Conceptual Targets...",
  "Structuring Mastery Path...",
  "Syncing Socratic Mental Models...",
];

export default function AnalyzingBridge({ isVisible }: { isVisible: boolean }) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 800);
    return () => clearInterval(interval);
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xl"
        >
          {/* Scanning Line Animation */}
          <div className="relative h-64 w-full max-w-2xl overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
            <motion.div
              animate={{
                top: ["0%", "100%", "0%"],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute left-0 right-0 h-px bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.8)]"
            />
            
            {/* Fake Code Content for Atmosphere */}
            <div className="p-6 font-mono text-sm text-slate-700 opacity-20">
              <div className="mb-2">function analyzeLogic(code) {"{"}</div>
              <div className="ml-4">const AST = parse(code);</div>
              <div className="ml-4 text-fuchsia-500/50">const topology = map(AST);</div>
              <div className="ml-4">return topology.resolve();</div>
              <div className="mb-2">{"}"}</div>
              <div className="mb-2 text-sky-500/50">{"// Agent Telemetry Initiated..."}</div>
              <div className="mb-2">{"while (mapping) { log(status); }"}</div>
            </div>
          </div>

          {/* Agent Telemetry */}
          <div className="mt-8 flex gap-8">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">CodeAnalyzer</span>
              <span className="text-xs text-fuchsia-400">Mapping Topologies...</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Designer</span>
              <span className="text-xs text-sky-400">Forging Logic Map...</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Mentor</span>
              <span className="text-xs text-emerald-400">Structuring Path...</span>
            </div>
          </div>

          {/* Dynamic Status Message */}
          <div className="mt-12 h-8">
            <AnimatePresence mode="wait">
              <motion.p
                key={messageIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-lg font-medium text-slate-200"
              >
                {messages[messageIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
