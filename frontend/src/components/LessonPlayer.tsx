import React from 'react';
import { motion } from 'framer-motion';
import { Code, Lightbulb, ChevronLeft } from 'lucide-react';
import { ChatInterface } from './ChatInterface';

interface LessonPlayerProps {
  content: {
    topic: string;
    content: string;
    code_examples: string[];
    animation_html: string;
  };
  onBack: () => void;
  userId: string;
  onPathUpdate: (newPath: any) => void;
}

export const LessonPlayer: React.FC<LessonPlayerProps> = ({ content, onBack, userId, onPathUpdate }) => {
  return (
    <div className="flex h-screen bg-[#020617] text-white overflow-hidden">
      {/* Left Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group">
            <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span>Back to Map</span>
          </button>
          <h2 className="text-lg font-semibold text-cyan-400">{content.topic}</h2>
          <div className="w-10" />
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Content & Code */}
          <div className="w-1/2 overflow-y-auto p-8 space-y-8 border-r border-slate-800 scrollbar-hide">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 text-purple-400 mb-2">
                <Lightbulb size={20} />
                <span className="text-sm font-bold uppercase tracking-widest">Concept Breakdown</span>
              </div>
              <p className="text-lg leading-relaxed text-slate-300">
                {content.content}
              </p>
            </motion.div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-cyan-400 mb-2">
                <Code size={20} />
                <span className="text-sm font-bold uppercase tracking-widest">Implementation</span>
              </div>
              {content.code_examples.map((code, idx) => (
                <div key={idx} className="bg-slate-900 rounded-xl p-4 border border-slate-800 font-mono text-sm text-slate-300 overflow-x-auto">
                  <pre><code>{code}</code></pre>
                </div>
              ))}
            </div>
          </div>

          {/* Animation Sandbox */}
          <div className="w-1/2 bg-slate-950 relative flex flex-col">
            <div className="absolute top-4 left-4 z-10 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-700 text-xs text-slate-400 backdrop-blur-md">
              Interactive Visualizer
            </div>
            <iframe 
              srcDoc={content.animation_html} 
              className="w-full h-full border-none"
              title="lesson-animation"
              sandbox="allow-scripts"
            />
          </div>
        </div>
      </div>

      {/* Right Side: AI Chat Interface */}
      <div className="w-80 shadow-2xl">
        <ChatInterface 
          userId={userId} 
          onDeepDiveTriggered={onPathUpdate} 
        />
      </div>
    </div>
  );
};
