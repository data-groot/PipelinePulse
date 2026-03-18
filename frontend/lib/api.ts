"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// In a real app we'd store the token in httpOnly cookie or secure storage,
// For this demo we'll use localStorage, but we need to ensure it's client-side only.
export function getToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("pp_token");
  }
  return null;
}

export function setToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("pp_token", token);
  }
}

export function removeToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("pp_token");
  }
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = {
    ...options.headers,
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE}${url}`, { ...options, headers });
  
  if (!response.ok) {
    if (response.status === 401) {
      removeToken();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error: ${response.status}`);
  }
  
  return response.json();
}

// ── Auth ───────────────────────────────────────────────────────

export const useLogin = () => {
  return useMutation({
    mutationFn: async (credentials: any) => {
      const data = await fetchWithAuth("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      setToken(data.access_token);
      return data;
    },
  });
};

export const useMe = () => {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => fetchWithAuth("/api/v1/auth/me"),
    retry: false,
  });
};

// ── Pipelines ──────────────────────────────────────────────────

export const usePipelines = () => {
  return useQuery({
    queryKey: ["pipelines"],
    queryFn: () => fetchWithAuth("/api/v1/pipelines"),
  });
};

export const usePipeline = (id: number) => {
  return useQuery({
    queryKey: ["pipelines", id],
    queryFn: () => fetchWithAuth(`/api/v1/pipelines/${id}`),
    enabled: !!id,
  });
};

export const useTogglePipeline = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchWithAuth(`/api/v1/pipelines/${id}`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });
};

// ── Runs ───────────────────────────────────────────────────────

export const useRuns = (params?: { dag_id?: string; status?: string; limit?: number }) => {
  return useQuery({
    queryKey: ["runs", params],
    queryFn: () => {
      const search = new URLSearchParams();
      if (params?.dag_id) search.append("dag_id", params.dag_id);
      if (params?.status) search.append("status", params.status);
      if (params?.limit) search.append("limit", params.limit.toString());
      return fetchWithAuth(`/api/v1/runs?${search.toString()}`);
    },
  });
};

export const useRun = (runId: string) => {
  return useQuery({
    queryKey: ["runs", runId],
    queryFn: () => fetchWithAuth(`/api/v1/runs/${runId}`),
    enabled: !!runId,
  });
};

// ── Quality ────────────────────────────────────────────────────

export const useQualityRuns = (params?: { table_name?: string; passed?: boolean; limit?: number }) => {
  return useQuery({
    queryKey: ["quality", params],
    queryFn: () => {
      const search = new URLSearchParams();
      if (params?.table_name) search.append("table_name", params.table_name);
      if (params?.passed !== undefined) search.append("passed", params.passed.toString());
      if (params?.limit) search.append("limit", params.limit.toString());
      return fetchWithAuth(`/api/v1/quality?${search.toString()}`);
    },
  });
};
