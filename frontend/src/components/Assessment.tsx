import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';

interface Question {
  id: number;
  text: string;
  options: string[];
  correct_answer: string;
}

interface AssessmentProps {
  subject: string;
  onComplete: (answers: string[]) => void;
}

export const Assessment: React.FC<AssessmentProps> = ({ subject, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  
  // Mock questions - in real app these come from /api/setup-assessment
  const questions: Question[] = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    text: `Question ${i + 1} about ${subject}: Which of the following is correct?`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correct_answer: 'Option A'
  }));

  const handleAnswer = (option: string) => {
    const newAnswers = [...answers];
    newAnswers[currentStep] = option;
    setAnswers(newAnswers);
    
    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete(newAnswers);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">{subject} Assessment</h2>
            <p className="text-slate-400 text-sm">Baseline evaluation: Question {currentStep + 1} of 10</p>
          </div>
          <div className="text-cyan-400 font-mono text-lg">
            {Math.round(((currentStep + 1) / 10) * 100)}%
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-800 rounded-full mb-12 overflow-hidden">
          <motion.div 
            className="h-full bg-cyan-400" 
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / 10) * 100}%` }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="card"
          >
            <h3 className="text-xl font-medium mb-8 text-white leading-relaxed">
              {questions[currentStep].text}
            </h3>

            <div className="grid grid-cols-1 gap-4">
              {questions[currentStep].options.map((option, idx) => (
                <motion.button
                  key={idx}
                  whileHover={{ scale: 1.01, backgroundColor: 'rgba(34, 211, 238, 0.1)' }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleAnswer(option)}
                  className="text-left p-4 rounded-xl border border-slate-700 bg-slate-800/50 hover:border-cyan-400 transition-all group flex items-center justify-between"
                >
                  <span className="text-slate-300 group-hover:text-white transition-colors">{option}</span>
                  <ChevronRight className="text-slate-600 group-hover:text-cyan-400 transition-colors" size={18} />
                </motion.button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
