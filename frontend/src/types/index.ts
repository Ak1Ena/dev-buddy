import type { SceneJSON } from "@/engine/types";
export type { SceneJSON };

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
  code_reference?: string;
}

export interface AssessmentResult {
  session_id: string;
  score: number;
  skill_level: string;
  strong_areas: string[];
  weak_areas: string[];
  recommendation: string;
  language: string;
}

export interface LessonProgress {
  status: "not_started" | "in_progress" | "completed" | "surrendered";
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

/* ── Visualization-first lesson view ── */
export interface CodeRef {
  /** index into LessonContent.code_walkthrough */
  walkthrough_index: number;
  /** 1-indexed inclusive line range */
  line_start: number;
  line_end: number;
}

export interface VizNode {
  id: string;
  label: string;
  summary: string;
  code_ref?: CodeRef;
  /** for tree/flow: ordered children ids */
  children?: string[];
}

export interface VizEdge {
  source: string;
  target: string;
  label?: string;
  code_ref?: CodeRef;
}

export interface VizTableCell {
  value: string;
  code_ref?: CodeRef;
}

export interface VizTableRow {
  label: string;
  cells: VizTableCell[];
}

export type Viz =
  | { kind: "tree"; root_id: string; nodes: VizNode[] }
  | { kind: "graph"; nodes: VizNode[]; edges: VizEdge[] }
  | { kind: "table"; columns: string[]; rows: VizTableRow[] }
  | { kind: "flow"; steps: VizNode[] };

export interface LessonContent {
  concept_hook?: string;
  animation_frames?: AnimationFrame[];
  scene?: SceneJSON;
  viz?: Viz;
  deep_dive?: {
    title: string;
    content: string;
    cards?: {
      title: string;
      content: string;
      icon: string;
      related_nodes: string[];
    }[];
    concepts?: string[];
  };
  code_walkthrough?: {
    code: string;
    plain_english: string;
    why: string;
  }[];
  explanation?: string;
  key_concepts?: string[];
  code_examples?: CodeExample[];
  visualizations?: Visualization[];
  workshops?: Workshop[];
  summary?: string;
}

export interface CanvasNode {
  id: string;
  type: "variable" | "literal" | "container" | "decision" | "action" | "outcome" | "data";
  label: string;
  value?: string;
  color?: "sky" | "emerald" | "fuchsia" | "amber" | "red" | "slate";
  highlight?: boolean;
  parent?: string;
}

export interface CanvasEdge {
  from: string;
  to: string;
  label?: string;
  style?: "arrow" | "dashed";
}

export interface CanvasSceneData {
  nodes: CanvasNode[];
  edges?: CanvasEdge[];
}

export interface AnimationEffect {
  effect: "pulse" | "flow" | "spawn" | "highlight" | "burst" | "fade";
  target?: string;
  from?: string;
  to?: string;
  from_value?: string;
  to_value?: string;
  why?: string;
  label?: string;
  color?: "sky" | "amber" | "emerald" | "fuchsia" | "red" | "slate";
}

export type DataStatus =
  | "filled"
  | "empty"
  | "active"
  | "updated"
  | "compare"
  | "result"
  | "removed";

export interface ArrayCell {
  key: string | number;
  value: string | null;
  status?: DataStatus;
  note?: string;
}

export interface ArrayCursor {
  key: string | number;
  label: string;
  color?: "sky" | "emerald" | "fuchsia" | "amber" | "red" | "slate";
}

export interface VarRow {
  name: string;
  value: string;
  status?: DataStatus;
  note?: string;
}

export interface ListItem {
  value: string;
  status?: DataStatus;
  note?: string;
}

export type DataView =
  | { kind: "array"; label: string; cells: ArrayCell[]; cursors?: ArrayCursor[]; note?: string }
  | { kind: "vars"; label: string; rows: VarRow[]; note?: string }
  | { kind: "object"; label: string; rows: VarRow[]; note?: string }
  | { kind: "stack"; label: string; items: ListItem[]; note?: string }
  | { kind: "queue"; label: string; items: ListItem[]; note?: string }
  | { kind: "branch"; label: string; condition: string; true_path?: string[]; false_path?: string[]; active_path?: "true" | "false" | null; note?: string };

export interface AnimationFrame {
  frame: number;
  title: string;
  code_state: string;
  canvas_scene?: CanvasSceneData;
  data_views?: DataView[];
  effects?: AnimationEffect[];
  visual?: string;
  narration: string;
  is_checkpoint?: boolean;
  checkpoint_question?: string;
  sub_frames?: AnimationFrame[];
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
  space_id?: string | null;
}

export interface LessonSurrenderResponse {
  lesson: Lesson;
  message?: string | null;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string | null;
  language: string;
  skill_level: string;
  total_lessons: number;
  completed_lessons: number;
  is_active?: boolean;
  lessons: Lesson[];
  created_at: string;
}

export interface SpaceSummary {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  path: LearningPath | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface LessonProposal {
  topic: string;
  title: string;
  description: string;
  estimated_minutes: number;
  position: "before" | "after";
  reference_lesson_id: string;
  rationale: string;
  evidence: string;
}

// ---- AI provider settings (M1, contract: docs/architecture/m1-ai-gateway.md "HTTP API") ----
// None of these types carry an API key: the browser sends a key once on save/test and only ever
// gets `key_hint` back.

export type AISlot = "text" | "live";

export interface AIProvider {
  id: string;
  label: string;
  needs_key: boolean;
  needs_base_url: boolean;
  default_base_url: string | null;
  supports_live: boolean;
  local: boolean;
}

export type AICredentialStatus = "untested" | "ok" | "failed";

export interface AICredential {
  id: string | number;
  slot: AISlot;
  provider: string;
  model: string | null;
  base_url: string | null;
  key_hint: string | null;
  status: AICredentialStatus;
  last_checked_at: string | null;
  last_error: string | null;
}

export type AIErrorCode =
  | "auth_failed"
  | "not_found"
  | "rate_limited"
  | "unreachable"
  | "bad_request"
  | "provider_error";

export interface AITestResult {
  ok: boolean;
  latency_ms?: number | null;
  model_count?: number | null;
  error_code?: AIErrorCode | string | null;
  message?: string | null;
}

export interface AIModel {
  id: string;
  label?: string | null;
  context_window?: number | null;
}
