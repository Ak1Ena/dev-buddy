'use client';

import React from 'react';
import { Question } from '@/types';

interface AssessmentCardProps {
  question: Question;
  onSelect: (answer: string) => void;
  selectedAnswer?: string;
}

export const AssessmentCard: React.FC<AssessmentCardProps> = ({
  question,
  onSelect,
  selectedAnswer,
}) => {
  return (
    <div className="p-6 bg-white rounded-xl shadow-md space-y-4 border border-gray-100">
      <h3 className="text-xl font-semibold text-gray-800">{question.question}</h3>
      <div className="space-y-2">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => onSelect(option)}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              selectedAnswer === option
                ? 'bg-blue-50 border-blue-500 text-blue-700'
                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};
