'use client';

import React, { useState, useEffect } from 'react';
import { AssessmentCard } from '@/components/assessment/AssessmentCard';
import { fetchQuestions, submitAssessment } from '@/services/api';
import { Question, EvaluationResult } from '@/types';
import { useRouter } from 'next/navigation';

export default function AssessmentPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const data = await fetchQuestions();
        setQuestions(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadQuestions();
  }, []);

  const handleSelect = (answer: string) => {
    if (questions.length === 0) return;
    setAnswers({
      ...answers,
      [questions[currentIndex].id]: answer,
    });
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setSubmitting(true);
      try {
        // Using a dummy user_id for now
        const response = await submitAssessment({
          user_id: 'user_123',
          answers,
        });
        setResult(response.evaluation);
      } catch (error) {
        console.error(error);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading assessment...</div>;
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center space-y-6">
          <h2 className="text-3xl font-bold text-gray-800">Assessment Complete!</h2>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-lg font-medium text-blue-800">Your Level: <span className="font-bold uppercase">{result.proficiency_baseline}</span></p>
            <p className="text-gray-600 mt-2">Score: {result.score.toFixed(1)}/10</p>
            <p className="text-gray-600">Conceptual Questions: {result.correct_answers}/{result.total_conceptual}</p>
          </div>
          <button 
            onClick={() => router.push('/lesson/1')}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Start Your Learning Path
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) return null;

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4">
      <div className="max-w-2xl w-full space-y-8">
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-medium text-gray-500">
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <AssessmentCard 
          question={currentQuestion} 
          onSelect={handleSelect}
          selectedAnswer={answers[currentQuestion.id]}
        />

        <div className="flex justify-between pt-4">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0 || submitting}
            className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <button
            onClick={handleNext}
            disabled={!answers[currentQuestion.id] || submitting}
            className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Submitting...' : currentIndex === questions.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
