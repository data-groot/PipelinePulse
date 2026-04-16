import axios from 'axios';

// Get base URL from env or use fallback
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_BASE,
});

// Configure interceptor to inject JWT token if available
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// -- Pipelines
export const fetchPipelines = async () => (await api.get('/pipelines')).data;
export const fetchPipelineRuns = async (dagId: string) => (await api.get(`/pipelines/${dagId}/runs`)).data;
export const triggerPipeline = async (dagId: string) => (await api.post(`/pipelines/${dagId}/trigger`)).data;
export const togglePipeline = async (dagId: string, isActive: boolean) => (await api.patch(`/pipelines/${dagId}/toggle`, { is_active: isActive })).data;

export interface PipelineCreatePayload {
  name: string;
  source_type: string;
  schedule: string;
  connection_config: Record<string, string>;
}

export interface Pipeline {
  id: number;
  user_id: number | null;
  name: string;
  source_type: string;
  schedule: string;
  enabled: boolean;
  dag_id: string | null;
  created_at: string;
}

export const createPipeline = async (data: PipelineCreatePayload): Promise<Pipeline> => {
  try {
    return (await api.post('/pipelines', data)).data;
  } catch (err: any) {
    const message = err?.response?.data?.detail ?? err?.message ?? 'Failed to create pipeline';
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
};

export interface PipelinePreview {
  pipeline_name: string;
  rows: Record<string, unknown>[];
  total_count: number;
  last_synced: string | null;
}

export const fetchPipelinePreview = async (pipelineId: number): Promise<PipelinePreview> =>
  (await api.get(`/pipelines/${pipelineId}/preview`)).data;

export interface SampleLoadResponse {
  pipeline_id: number;
  dag_id: string;
  name: string;
  status: string;
  message: string;
}

export const loadSampleData = async (): Promise<SampleLoadResponse> =>
  (await api.post('/pipelines/samples/load')).data;

export const loadSamplePipeline = async (): Promise<Pipeline> => {
  try {
    return (await api.post('/pipelines/sample')).data;
  } catch (err: any) {
    const message = err?.response?.data?.detail ?? err?.message ?? 'Failed to create sample pipeline';
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
};

export interface AvgQualityResponse {
  avg_score_pct: number;
  pipeline_count: number;
  check_count: number;
}

export const fetchAvgQuality = async (): Promise<AvgQualityResponse> =>
  (await api.get('/quality/avg')).data;

// -- Metrics
export const fetchMetricsSummary = async () => (await api.get('/metrics/summary')).data;
export const fetchWeatherMetrics = async (dateFrom?: string, dateTo?: string) => {
  const params = new URLSearchParams();
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  return (await api.get(`/metrics/weather?${params.toString()}`)).data;
};
export const fetchRevenueMetrics = async (dateFrom?: string, dateTo?: string) => {
  const params = new URLSearchParams();
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  return (await api.get(`/metrics/revenue?${params.toString()}`)).data;
};

// -- Quality
export const fetchQualityScores = async () => (await api.get('/quality/scores')).data;
export const fetchQualityAlerts = async () => (await api.get('/quality/alerts')).data;

// -- Auth
// POST /auth/login expects JSON {email, password} and returns {access_token, token_type}.
// The auth router is mounted at /auth on the server root (no /api prefix).
// withCredentials=true ensures the httpOnly cookie is stored by the browser.
export const fetchToken = async (email: string, password: string) => {
  const rootUrl = API_BASE.replace(/\/api.*$/, '');
  return (await axios.post(`${rootUrl}/auth/login`, { email, password }, {
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
  })).data;
};

export const fetchSignup = async (email: string, password: string) => {
  const rootUrl = API_BASE.replace(/\/api.*$/, '');
  return (await axios.post(`${rootUrl}/auth/signup`, { email, password }, {
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
  })).data;
};

export const fetchLogout = async () => {
  const rootUrl = API_BASE.replace(/\/api.*$/, '');
  await axios.post(`${rootUrl}/auth/logout`, {}, { withCredentials: true });
};

export const logout = async (): Promise<void> => {
  const rootUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/api.*$/, '');
  await axios.post(`${rootUrl}/auth/logout`, {}, { withCredentials: true });
};
