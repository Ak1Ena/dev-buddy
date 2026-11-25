import axios from "axios";
import Cookies from "js-cookie";
import type {
  AICredential,
  AIModel,
  AIProvider,
  AISlot,
  AITestResult,
  LessonSurrenderResponse,
} from "@/types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const api = axios.create({
  baseURL: `${BASE}/api/v1`,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// AC-AUTH-002: silently refresh expired access tokens using the 30-day refresh token
let _refreshing = false;
let _queue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

function _drainQueue(err: unknown, token?: string) {
  _queue.forEach((p) => (err ? p.reject(err) : p.resolve(token!)));
  _queue = [];
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    const refreshToken = Cookies.get("refresh_token");
    if (!refreshToken) {
      const { useAuthStore } = await import("@/store/auth");
      useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    }
    if (_refreshing) {
      return new Promise<string>((resolve, reject) => _queue.push({ resolve, reject })).then(
        (token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
      );
    }
    original._retry = true;
    _refreshing = true;
    try {
      const res = await axios.post(`${BASE}/api/v1/auth/refresh`, { refresh_token: refreshToken });
      const { access_token, refresh_token: newRefresh } = res.data;
      Cookies.set("access_token", access_token, { expires: 1, sameSite: "lax" });
      Cookies.set("refresh_token", newRefresh, { expires: 30, sameSite: "lax" });
      api.defaults.headers.common.Authorization = `Bearer ${access_token}`;
      _drainQueue(null, access_token);
      original.headers.Authorization = `Bearer ${access_token}`;
      return api(original);
    } catch (err) {
      _drainQueue(err);
      const { useAuthStore } = await import("@/store/auth");
      useAuthStore.getState().clearAuth();
      return Promise.reject(err);
    } finally {
      _refreshing = false;
    }
  }
);

export const authApi = {
  register: (data: { email: string; username: string; password: string; full_name?: string }) =>
    api.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
};

export const assessmentApi = {
  // User pastes their code — backend analyzes it and generates 10 questions
  start: (code_snippet: string) =>
    api.post("/assessment/start", { code_snippet }),
  getSession: (sessionId: string) =>
    api.get(`/assessment/session/${sessionId}`),
  submitAnswer: (data: { session_id: string; question_id: string; answer_key: string }) =>
    api.post("/assessment/submit-answer", data),
  complete: (sessionId: string) =>
    api.post(`/assessment/complete/${sessionId}`),
};

export const learningApi = {
  instantDiscovery: (code_snippet: string) =>
    api.post("/learning/instant-discovery", { code_snippet }),
  generatePath: () =>
    api.post("/learning/generate-path"),
  getActivePath: () => api.get("/learning/path"),
  getLesson: (lessonId: string) => api.get(`/learning/lesson/${lessonId}`),
  surrenderLesson: (lessonId: string) =>
    api.post<LessonSurrenderResponse>(`/learning/lesson/${lessonId}/surrender`),
  updateProgress: (
    lessonId: string,
    data: { status?: string; hints_used?: number; workshop_score?: number; time_spent_seconds?: number }
  ) => api.patch(`/learning/lesson/${lessonId}/progress`, data),
  createSpace: (name: string) => api.post("/learning/spaces", { name }),
  listSpaces: () => api.get("/learning/spaces"),
  activateSpace: (spaceId: string) => api.patch(`/learning/spaces/${spaceId}/activate`),
};

export const chatApi = {
  send: (data: {
    message: string;
    session_id?: string;
    lesson_id?: string;
    code_context?: string;
    hint_level?: number;
    current_frame?: number | null;
    is_checkpoint?: boolean | null;
  }) => api.post("/chat/send", data),
  getSession: (sessionId: string) => api.get(`/chat/session/${sessionId}`),
  stream: (data: {
    message: string;
    session_id?: string;
    lesson_id?: string;
    code_context?: string;
    hint_level?: number;
    current_frame?: number | null;
    is_checkpoint?: boolean | null;
  }, onChunk: (chunk: string, sessionId: string) => void) => {
    const token = Cookies.get("access_token");
    return fetch(`${BASE}/api/v1/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
  },
  acceptProposal: (data: {
    session_id: string;
    topic: string;
    title: string;
    description: string;
    estimated_minutes: number;
    position: "before" | "after";
    reference_lesson_id: string;
  }) => api.post("/chat/proposal/accept", data),
  rejectProposal: (data: {
    session_id: string;
    topic: string;
  }) => api.post("/chat/proposal/reject", data),
};

// AI provider settings (M1). The gateway lives under /api/ai, not /api/v1, so these calls
// override baseURL per request but still go through `api` for the JWT and refresh interceptors.
// The browser only talks to the Nexora backend; the key goes there once (save / draft test) and
// is never returned (responses carry `key_hint` only).
const AI_BASE = { baseURL: `${BASE}/api/ai` };

export const aiApi = {
  providers: () => api.get<AIProvider[]>("/providers", AI_BASE),
  credentials: () => api.get<AICredential[]>("/credentials", AI_BASE),
  save: (
    slot: AISlot,
    data: { provider: string; model?: string | null; base_url?: string | null; api_key?: string }
  ) => api.put<AICredential>(`/credentials/${slot}`, data, AI_BASE),
  test: (slot: AISlot) => api.post<AITestResult>(`/credentials/${slot}/test`, undefined, AI_BASE),
  // `slot` lets the backend reuse the key already saved there when api_key is left out.
  testDraft: (data: { provider: string; base_url?: string | null; api_key?: string; slot?: AISlot }) =>
    api.post<AITestResult>("/test-draft", data, AI_BASE),
  models: (slot: AISlot) => api.get<AIModel[]>(`/credentials/${slot}/models`, AI_BASE),
  remove: (slot: AISlot) => api.delete(`/credentials/${slot}`, AI_BASE),
};

export const sceneApi = {
  analyze: (code: string) => api.post<{ session_id: string }>("/scenes/analyze", { code }),
  getScene: (sessionId: string) => api.get(`/scenes/scene/${sessionId}`),
};
