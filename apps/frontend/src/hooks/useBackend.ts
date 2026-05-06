import { useState, useCallback } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

interface UseBackendOptions {
  onError?: (error: string) => void;
}

export function useBackend({ onError }: UseBackendOptions = {}) {
  const [loading, setLoading] = useState(false);

  const request = useCallback(async <T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T | null> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (!isJson) {
        throw new Error(`HTTP ${res.status} — unexpected response from server`);
      }
      const data = await res.json();
      if (!data.success) {
        const suffix = data.debugId ? ` [${data.debugId}]` : '';
        throw new Error(`${data.error || 'Request failed'}${suffix}`);
      }
      return data as T;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onError?.(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [onError]);

  const generateBatch = useCallback((params: {
    input: string;
    count?: number;
    mode?: 'FAST' | 'FULL' | 'HYBRID';
    differentialCurve?: string;
  }) => request('/generate-batch', { method: 'POST', body: JSON.stringify(params) }), [request]);

  const startEvolution = useCallback((params: {
    seedDesigns?: any[];
    maxGenerations?: number;
    populationSize?: number;
    mutationRate?: number;
  }) => request<{ runId: string; status: string }>('/evolve', { method: 'POST', body: JSON.stringify(params) }), [request]);

  const getEvolutionState = useCallback((runId: string) =>
    request(`/evolve/${runId}`), [request]);

  const pauseEvolution = useCallback((runId: string) =>
    request(`/evolve/${runId}/pause`, { method: 'POST' }), [request]);

  const getDesigns = useCallback((params?: { minScore?: number; generation?: number; limit?: number }) => {
    const qs = params ? new URLSearchParams(params as any).toString() : '';
    return request(`/designs${qs ? `?${qs}` : ''}`);
  }, [request]);

  const importDesigns = useCallback((designs: any[], preserveIds = false) =>
    request('/import', { method: 'POST', body: JSON.stringify({ designs, preserveIds }) }), [request]);

  const exportDesign = useCallback((id: string) => request(`/export/${id}`), [request]);

  const getDemand = useCallback(() => request('/demand'), [request]);

  return { loading, generateBatch, startEvolution, getEvolutionState, pauseEvolution, getDesigns, importDesigns, exportDesign, getDemand };
}
