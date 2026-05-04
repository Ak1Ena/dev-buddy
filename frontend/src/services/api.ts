import { Question, AssessmentResponse, EvaluationResult } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export const fetchQuestions = async (): Promise<Question[]> => {
  const res = await fetch(`${API_BASE_URL}/assessment/questions`);
  if (!res.ok) {
    throw new Error('Failed to fetch questions');
  }
  return res.json();
};

export const submitAssessment = async (data: AssessmentResponse): Promise<{ user_id: string; evaluation: EvaluationResult }> => {
  const res = await fetch(`${API_BASE_URL}/assessment/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error('Failed to submit assessment');
  }
  return res.json();
};
