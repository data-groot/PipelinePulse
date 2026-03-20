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
export const fetchToken = async (username: string, password: string) => {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  
  // Auth uses the root server /auth/token, not /api/auth
  const rootUrl = API_BASE.replace('/api', '');
  return (await axios.post(`${rootUrl}/auth/token`, formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })).data;
};
