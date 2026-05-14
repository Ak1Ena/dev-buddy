import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimelineStore } from '../timeline/useTimelineStore';

interface GateProps {
  x: number;
  y: number;
  question: string;
  options: string[];
  correctAnswer: string;
  feedback?: string;
  progress: number;
}

export const Gate: React.FC<GateProps> = ({
  x,
  y,
  question,
  options,
  correctAnswer,
  feedback,
  progress
}) => {
  const { waitAtGate, resumeFromGate, isPlaying } = useTimelineStore();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  useEffect(() => {
    // When this primitive becomes active, it should pause the timeline if not already waiting/resolved
    if (isPlaying === 1 && !isCorrect) {
      waitAtGate();
    }
  }, [isPlaying, waitAtGate, isCorrect]);

  const handleOptionClick = (option: string) => {
    setSelectedOption(option);
    const correct = option === correctAnswer;
    setIsCorrect(correct);
    setShowFeedback(true);

    if (correct) {
      setTimeout(() => {
        resumeFromGate();
      }, 1500);
    }
  };

  return (
    <AnimatePresence>
      {isPlaying === 2 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          style={{
            position: 'absolute',
            left: `${x / 10}%`,
            top: `${y / 10}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: 100,
            width: '300px',
            background: 'rgba(30, 41, 59, 0.95)',
            backdropFilter: 'blur(8px)',
            border: '2px solid #F59E0B', // Amber
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
          }}
        >
          <h3 style={{ color: '#F3F4F6', fontSize: '1.1rem', marginBottom: '16px', fontWeight: 'bold' }}>
            {question}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {options.map((option) => (
              <button
                key={option}
                onClick={() => !showFeedback && handleOptionClick(option)}
                style={{
                  padding: '10px 15px',
                  borderRadius: '8px',
                  border: '1px solid #4B5563',
                  background: selectedOption === option 
                    ? (option === correctAnswer ? '#059669' : '#DC2626')
                    : '#374151',
                  color: 'white',
                  cursor: showFeedback ? 'default' : 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
              >
                {option}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                style={{ marginTop: '16px', color: isCorrect ? '#10B981' : '#F87171', fontSize: '0.9rem' }}
              >
                {isCorrect ? 'Correct! Resuming...' : (feedback || 'Not quite. Try again!')}
                {!isCorrect && (
                  <button 
                    onClick={() => {
                      setShowFeedback(false);
                      setSelectedOption(null);
                    }}
                    style={{ 
                      display: 'block', 
                      marginTop: '8px', 
                      color: '#9CA3AF', 
                      textDecoration: 'underline',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Reset
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Gate;
