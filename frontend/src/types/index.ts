export interface Question {
  id: number;
  question: string;
  options: string[];
  category: string;
}

export interface AssessmentResponse {
  user_id: string;
  answers: Record<number, string>;
}

export interface EvaluationResult {
  proficiency_baseline: string;
  score: number;
  correct_answers: number;
  total_conceptual: number;
}
