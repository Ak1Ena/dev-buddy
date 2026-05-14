import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Database, Layers, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecutionStateViewProps {
  state: string;
}

export const ExecutionStateView: React.FC<ExecutionStateViewProps> = ({ state }) => {
  // Try to parse state if it's JSON-like or structured
  const lines = state.split('\n').filter(l => l.trim());
  
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700/50 bg-slate-950/60 glass-panel shadow-2xl transition-all duration-500 group-hover:border-sky-500/40">
      <div className="flex items-center justify-between bg-slate-900/80 px-5 py-2.5 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
            <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-red-500/80" />
                <div className="h-2 w-2 rounded-full bg-amber-500/80" />
                <div className="h-2 w-2 rounded-full bg-emerald-500/80" />
            </div>
            <div className="h-4 w-[1px] bg-slate-800 mx-2" />
            <div className="flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Live Runtime Snapshot</span>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-500/80 uppercase tracking-tighter">
                <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                Attached
            </span>
        </div>
      </div>
      
      <div className="relative">
        {/* Decorative background icons */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none">
            <Cpu className="h-32 w-32 text-white" />
        </div>

        <div className="px-6 py-6 font-mono text-sm leading-relaxed overflow-x-auto min-h-[120px]">
            <AnimatePresence mode="popLayout">
                <div className="space-y-2">
                    {lines.map((line, i) => {
                        const isAssignment = line.includes('=');
                        const isReturn = line.toLowerCase().includes('return');
                        const isFunction = line.includes('(');
                        
                        return (
                            <motion.div 
                                key={`${line}-${i}`}
                                initial={{ opacity: 0, x: -5 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className={cn(
                                    "flex items-start gap-3 group/line px-2 py-1 rounded transition-colors hover:bg-white/5",
                                    isReturn && "text-emerald-400 font-bold bg-emerald-500/5",
                                    isAssignment && "text-sky-300",
                                    !isReturn && !isAssignment && "text-slate-300"
                                )}
                            >
                                <span className="text-[10px] text-slate-600 w-4 text-right select-none font-bold tabular-nums group-hover/line:text-slate-400">{i + 1}</span>
                                <div className="flex-1 whitespace-pre-wrap break-all">
                                    {line.split(' ').map((word, j) => {
                                        const isKeyword = ['def', 'function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while'].includes(word.replace(/[:()]/g, ''));
                                        return (
                                            <span key={j} className={cn(
                                                isKeyword && "text-fuchsia-400 font-bold",
                                                word.match(/^[0-9]+$/) && "text-amber-400"
                                            )}>
                                                {word}{' '}
                                            </span>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </AnimatePresence>
        </div>
      </div>
      
      {/* Metrics Footer */}
      <div className="bg-slate-900/40 px-5 py-2 border-t border-slate-800/60 flex items-center gap-6">
        <div className="flex items-center gap-1.5">
            <Database className="h-3 w-3 text-slate-500" />
            <span className="text-[9px] font-bold text-slate-500 uppercase">Heap: <span className="text-slate-300">Active</span></span>
        </div>
        <div className="flex items-center gap-1.5">
            <Layers className="h-3 w-3 text-slate-500" />
            <span className="text-[9px] font-bold text-slate-500 uppercase">Stack: <span className="text-slate-300">{lines.length} Frames</span></span>
        </div>
      </div>
    </div>
  );
};

export default ExecutionStateView;
