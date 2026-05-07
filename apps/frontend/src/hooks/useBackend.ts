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

  const getDemand = useCallback((params?: { input?: string }) => {
    const qs = params?.input ? `?${new URLSearchParams({ input: params.input }).toString()}` : '';
    return request(`/demand${qs}`);
  }, [request]);

  const getReinforcementReplay = useCallback(() => request('/reinforcement/replay'), [request]);

  const runReplayVerify = useCallback((params?: { persist?: boolean }) => {
    const qs = params?.persist === false ? '?persist=false' : '';
    return request(`/replay/verify${qs}`);
  }, [request]);

  const getReplayHistory = useCallback((params?: { stream?: string; limit?: number }) => {
    const qs = params ? new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => [key, String(value)]),
    ).toString() : '';
    return request(`/replay/history${qs ? `?${qs}` : ''}`);
  }, [request]);

  const getReplayMonitor = useCallback((params?: { stream?: string }) => {
    const qs = params?.stream ? `?${new URLSearchParams({ stream: params.stream }).toString()}` : '';
    return request(`/replay/monitor${qs}`);
  }, [request]);

  const getReplayMonitorHistory = useCallback((params?: { stream?: string; limit?: number }) => {
    const qs = params ? new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => [key, String(value)]),
    ).toString() : '';
    return request(`/replay/monitor/history${qs ? `?${qs}` : ''}`);
  }, [request]);

  const acknowledgeReplayMonitor = useCallback((snapshotId: string, acknowledgedBy = 'operator') =>
    request(`/replay/monitor/${snapshotId}/ack`, {
      method: 'POST',
      body: JSON.stringify({ acknowledgedBy }),
    }), [request]);

  const getReplayCheckpointDiff = useCallback((params: {
    stream?: string;
    baseId: string;
    targetId: string;
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => [key, String(value)]),
    ).toString();
    return request(`/replay/checkpoints/diff?${qs}`);
  }, [request]);

  const getContinuityExport = useCallback((params?: {
    stream?: string;
    checkpointId?: string;
    limit?: number;
  }) => {
    const qs = params ? new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => [key, String(value)]),
    ).toString() : '';
    return request(`/continuity/export${qs ? `?${qs}` : ''}`);
  }, [request]);

  const getDegradedReplayExport = useCallback((params?: {
    stream?: string;
    checkpointId?: string;
    snapshotId?: string;
    limit?: number;
  }) => {
    const qs = params ? new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => [key, String(value)]),
    ).toString() : '';
    return request(`/replay/degraded-export${qs ? `?${qs}` : ''}`);
  }, [request]);

  const getReleaseReadiness = useCallback((params?: {
    stream?: string;
    provider?: string;
    persistMonitor?: boolean;
    persistEvidence?: boolean;
    includeRollbackPreflight?: boolean;
  }) => {
    const qs = params ? new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => [key, String(value)]),
    ).toString() : '';
    return request(`/release/readiness${qs ? `?${qs}` : ''}`);
  }, [request]);

  const getReleaseEvidenceHistory = useCallback((params?: { stream?: string; limit?: number }) => {
    const qs = params ? new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => [key, String(value)]),
    ).toString() : '';
    return request(`/release/evidence${qs ? `?${qs}` : ''}`);
  }, [request]);

  const getReleaseEvidenceExport = useCallback((params?: {
    stream?: string;
    provider?: string;
    limit?: number;
    includeRollbackPreflight?: boolean;
  }) => {
    const qs = params ? new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => [key, String(value)]),
    ).toString() : '';
    return request(`/release/evidence/export${qs ? `?${qs}` : ''}`);
  }, [request]);

  return {
    loading,
    generateBatch,
    startEvolution,
    getEvolutionState,
    pauseEvolution,
    getDesigns,
    importDesigns,
    exportDesign,
    getDemand,
    getReinforcementReplay,
    runReplayVerify,
    getReplayHistory,
    getReplayMonitor,
    getReplayMonitorHistory,
    acknowledgeReplayMonitor,
    getReplayCheckpointDiff,
    getContinuityExport,
    getDegradedReplayExport,
    getReleaseReadiness,
    getReleaseEvidenceHistory,
    getReleaseEvidenceExport,
  };
}
