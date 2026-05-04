import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, ArrowRight, CheckCircle2 } from 'lucide-react';

interface SubjectSelectionProps {
  onSelect: (subject: string) => void;
}

const subjects = [
  { id: 'python', name: 'Python', desc: 'The language of AI and Data Science', icon: '🐍' },
  { id: 'react', name: 'React', desc: 'Modern UI development with components', icon: '⚛️' },
  { id: 'rust', name: 'Rust', desc: 'Systems programming with memory safety', icon: '🦀' },
  { id: 'typescript', name: 'TypeScript', desc: 'Static typing for JavaScript', icon: '📘' },
  { id: 'go', name: 'Go', desc: 'Efficient concurrency for backend', icon: '🐹' },
  { id: 'cpp', name: 'C++', desc: 'High-performance systems and games', icon: '⚙️' },
];

export const SubjectSelection: React.FC<SubjectSelectionProps> = ({ onSelect }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-bold mb-4 text-white">What do you want to master?</h1>
        <p className="text-slate-400">Choose a subject to start your personalized journey</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
        {subjects.map((sub, idx) => (
          <motion.div
            key={sub.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ scale: 1.05, borderColor: 'var(--accent-cyan)' }}
            onClick={() => onSelect(sub.name)}
            className="card cursor-pointer group relative overflow-hidden transition-all"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="text-4xl mb-4">{sub.icon}</div>
            <h3 className="text-xl font-semibold mb-2 text-white group-hover:text-cyan-400 transition-colors">{sub.name}</h3>
            <p className="text-sm text-slate-400 mb-4">{sub.desc}</p>
            <div className="flex justify-end">
              <ArrowRight className="text-slate-600 group-hover:text-cyan-400 transition-colors" size={20} />
            </div>
            <div className="absolute bottom-0 left-0 h-1 bg-cyan-400 transition-all duration-300 w-0 group-hover:w-full" />
          </motion.div>
        ))}
      </div>
    </div>
  );
};
