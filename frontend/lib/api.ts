import axios from 'axios';

// All requests use relative URLs and are proxied to the backend by Next.js
// rewrites (see next.config.ts), so the auth cookie is always first-party
// and no CORS configuration is needed in production.
export const api = axios.create({ withCredentials: true });

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') err.message = detail;
    return Promise.reject(err);
  }
);

// --- Types (mirror backend/app/schemas.py) ---

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface Pipeline {
  id: number;
  name: string;
  source_type: 'rest_api' | 'postgresql' | 'csv';
  schedule: '5min' | 'hourly' | 'daily' | 'weekly' | 'manual';
  enabled: boolean;
  timestamp_field: string | null;
  metric_field: string | null;
  next_run_at: string | null;
  created_at: string;
  last_run_status: string | null;
  last_run_at: string | null;
  rows_processed: number;
}

export interface PipelineCreatePayload {
  name: string;
  source_type: string;
  schedule: string;
  connection_config: Record<string, string>;
  timestamp_field?: string | null;
  metric_field?: string | null;
}

export interface Run {
  id: number;
  pipeline_id: number;
  pipeline_name: string | null;
  status: 'running' | 'success' | 'failed';
  trigger: 'manual' | 'scheduled';
  started_at: string;
  finished_at: string | null;
  rows_processed: number;
  error_message: string | null;
}

export interface QualityCheck {
  id: number;
  pipeline_id: number;
  pipeline_name: string | null;
  check_name: string;
  passed: boolean;
  score: number;
  details: Record<string, unknown> | null;
  checked_at: string;
}

export interface Overview {
  total_pipelines: number;
  enabled_pipelines: number;
  healthy_pipelines: number;
  avg_quality_score: number | null;
  runs_last_24h: number;
  last_activity: string | null;
}

export interface DailyMetric {
  day: string;
  row_count: number;
  metric_sum: number | null;
  metric_avg: number | null;
}

export interface QualitySummary {
  avg_score_pct: number | null;
  failing_checks_24h: number;
}

// --- Auth ---

export const signup = async (email: string, password: string): Promise<User> =>
  (await api.post('/auth/signup', { email, password })).data;
export const login = async (email: string, password: string): Promise<User> =>
  (await api.post('/auth/login', { email, password })).data;
export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};
export const fetchMe = async (): Promise<User> => (await api.get('/auth/me')).data;

// --- Pipelines ---

export const fetchPipelines = async (): Promise<Pipeline[]> =>
  (await api.get('/api/pipelines')).data;
export const createPipeline = async (payload: PipelineCreatePayload): Promise<Pipeline> =>
  (await api.post('/api/pipelines', payload)).data;
export const createSamplePipeline = async (): Promise<Pipeline> =>
  (await api.post('/api/pipelines/sample')).data;
export const deletePipeline = async (id: number): Promise<void> => {
  await api.delete(`/api/pipelines/${id}`);
};
export const togglePipeline = async (id: number): Promise<Pipeline> =>
  (await api.patch(`/api/pipelines/${id}/toggle`)).data;
export const triggerPipeline = async (id: number): Promise<Run> =>
  (await api.post(`/api/pipelines/${id}/trigger`)).data;
export const uploadCsv = async (id: number, file: File): Promise<{ rows_ingested: number }> => {
  const form = new FormData();
  form.append('file', file);
  return (await api.post(`/api/pipelines/${id}/upload`, form)).data;
};

export interface PipelinePreview {
  pipeline_id: number;
  rows: { payload: Record<string, unknown> | null; ingested_at: string }[];
}
export const fetchPreview = async (id: number): Promise<PipelinePreview> =>
  (await api.get(`/api/pipelines/${id}/preview`)).data;

// --- Runs ---

export const fetchRuns = async (pipelineId?: number, limit = 50): Promise<Run[]> => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (pipelineId != null) params.set('pipeline_id', String(pipelineId));
  return (await api.get(`/api/runs?${params}`)).data;
};

// --- Quality ---

export const fetchQualitySummary = async (): Promise<QualitySummary> =>
  (await api.get('/api/quality/summary')).data;
export const fetchQualityScores = async (): Promise<QualityCheck[]> =>
  (await api.get('/api/quality/scores')).data;
export const fetchQualityAlerts = async (): Promise<QualityCheck[]> =>
  (await api.get('/api/quality/alerts')).data;
export const fetchQualityHistory = async (pipelineId: number): Promise<QualityCheck[]> =>
  (await api.get(`/api/quality/history?pipeline_id=${pipelineId}`)).data;

// --- Metrics ---

export const fetchOverview = async (): Promise<Overview> =>
  (await api.get('/api/metrics/overview')).data;
export const fetchDailyMetrics = async (pipelineId: number, days = 30): Promise<DailyMetric[]> =>
  (await api.get(`/api/metrics/daily?pipeline_id=${pipelineId}&days=${days}`)).data;
