interface ScoringWeights {
  trend: number;
  psychology: number;
  leaderboard: number;
  retention: number;
  demand: number;
  simulation: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  trend: 0.20,
  psychology: 0.20,
  leaderboard: 0.20,
  retention: 0.20,
  demand: 0.10,
  simulation: 0.10,
};

export function calculateScore(
  metrics: {
    simulation?: number;
    demandScore?: number;
    freshnessFactor?: number;
  },
  weights: Partial<ScoringWeights> = {},
): number {
  const w = { ...DEFAULT_WEIGHTS, ...weights };

  const base =
    w.trend * 0.75 +
    w.psychology * 0.60 +
    w.leaderboard * 0.50 +
    w.retention * 0.65;

  const demand = (metrics.demandScore ?? 0.5) * w.demand;

  const rawSim = metrics.simulation ?? 0;
  const freshness = metrics.freshnessFactor ?? 1.0;
  const cappedSim = Math.min(rawSim * freshness, 0.08);

  const total = clamp(base + demand + cappedSim, 0, 1);
  return clamp(total, 0.2, 0.8);
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}
