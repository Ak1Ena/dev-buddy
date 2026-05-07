export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  skill_level: "beginner" | "intermediate" | "advanced";
  preferred_language: string;
  assessment_completed: boolean;
  avatar_url: string | null;
  created_at: string;
}

export interface AssessmentOption { key: string; text: string; }

export interface AssessmentQuestion {
  id: string;
  question: string;
  options: AssessmentOption[];
  topic: string;
  difficulty: string;
}

export interface AssessmentResult {
  session_id: string;
  score: number;
  skill_level: string;
  strong_areas: string[];
  weak_areas: string[];
  recommendation: string;
}

export interface LessonProgress {
  status: "not_started" | "in_progress" | "completed";
  hints_used: number;
  workshop_score: number | null;
  time_spent_seconds: number;
}

export interface CodeExample {
  title: string;
  code: string;
  explanation: string;
  language: string;
}

export interface VisualizationStep {
  step: number;
  description: string;
  state: Record<string, unknown>;
}

export interface Visualization {
  type: "variable_trace" | "loop_trace" | "call_stack" | "memory_diagram";
  title: string;
  code: string;
  steps: VisualizationStep[];
}

export interface Workshop {
  type: "predict_output" | "fill_in_blank" | "debug_challenge" | "multiple_choice";
  title: string;
  description: string;
  code: string;
  answer: string;
  hints: string[];
  explanation: string;
}

export interface LessonContent {
  explanation: string;
  key_concepts: string[];
  code_examples: CodeExample[];
  visualizations: Visualization[];
  workshops: Workshop[];
  summary: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string | null;
  topic: string;
  order_index: number;
  estimated_minutes: number;
  difficulty: string;
  content: LessonContent | null;
  progress: LessonProgress | null;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string | null;
  language: string;
  skill_level: string;
  total_lessons: number;
  completed_lessons: number;
  lessons: Lesson[];
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
