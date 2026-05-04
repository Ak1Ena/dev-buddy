import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, BookOpen, Star } from 'lucide-react';

interface Topic {
  title: string;
  isCompleted: boolean;
  isDeepDive?: boolean;
}

interface LearningPathMapProps {
  path: Topic[];
  currentIndex: number;
  onTopicSelect: (index: number) => void;
}

export const LearningPathMap: React.FC<LearningPathMapProps> = ({ path, currentIndex, onTopicSelect }) => {
  return (
    <div className="flex flex-col items-center py-8 px-4">
      <div className="relative flex flex-col gap-8 w-full max-w-md">
        {/* Vertical Path Line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-slate-800 -translate-x-1/2 z-0" />
        
        {path.map((topic, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isLocked = idx > currentIndex;

          return (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => !isLocked && onTopicSelect(idx)}
              className={`relative z-10 flex items-center justify-center cursor-pointer group ${isLocked ? 'cursor-not-allowed' : ''}`}
            >
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
                ${isCompleted ? 'bg-cyan-400 text-slate-900' : isCurrent ? 'bg-white text-slate-900 ring-4 ring-cyan-400' : 'bg-slate-800 text-slate-500 border border-slate-700'}
                ${!isLocked && 'group-hover:ring-4 group-hover:ring-cyan-400/50'}
              `}>
                {isCompleted ? <CheckCircle2 size={24} /> : <BookOpen size={24} />}
              </div>
              
              <div className={`
                absolute ${idx % 2 === 0 ? 'left-16 text-left' : 'right-16 text-right'}
                transition-all duration-300
                ${isLocked ? 'opacity-50' : 'opacity-100'}
              `}>
                <div className="flex items-center gap-2">
                  {idx % 2 !== 0 && <span className="text-xs font-bold text-cyan-400 uppercase">Topic {idx + 1}</span>}
                  <span className={`text-lg font-medium ${isCurrent ? 'text-white' : 'text-slate-300'}`}>
                    {topic.title}
                  </span>
                  {idx % 2 === 0 && <span className="text-xs font-bold text-cyan-400 uppercase">Topic {idx + 1}</span>}
                </div>
                {topic.isDeepDive && (
                  <div className="flex items-center gap-1 text-purple-400 text-xs font-bold">
                    <Star size={10} fill="currentColor" /> Deep Dive
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// Helper component for the check icon
const CheckCircle2 = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-//C18.3 12 18.3 12 18.3 12" /> {/* simplified for example */}
    <polyline points="22 11 16 5 10 11" />
  </svg>
);
