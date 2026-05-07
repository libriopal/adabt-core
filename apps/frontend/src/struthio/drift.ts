/**
 * STRUTHIO-SEC Drift Detector
 * 
 * Monitors for architectural drift, state divergence, and
 * unexpected mutations that could destabilize the system.
 */

import { createScopedLogger } from '../debug/trace';
import { metrics } from '../debug/metrics';

const log = createScopedLogger('DRIFT');

export type DriftType = 
  | 'state_divergence'
  | 'seed_mismatch'
  | 'evolution_runaway'
  | 'memory_corruption'
  | 'architecture_violation'
  | 'performance_anomaly';

export interface DriftEvent {
  id: string;
  type: DriftType;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  context: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: number;
}

export interface DriftThresholds {
  maxFitnessDelta: number;
  maxMutationRate: number;
  maxMemoryNodes: number;
  maxLatencyMs: number;
  minDiversityIndex: number;
}

export interface DriftMonitorConfig {
  enabled: boolean;
  thresholds: DriftThresholds;
  windowSizeMs: number;
  alertCallback?: (event: DriftEvent) => void;
}

const DEFAULT_THRESHOLDS: DriftThresholds = {
  maxFitnessDelta: 0.5, // Max fitness change per epoch
  maxMutationRate: 0.3, // Max mutation rate
  maxMemoryNodes: 10000, // Max memory graph nodes
  maxLatencyMs: 5000, // Max operation latency
  minDiversityIndex: 0.1, // Min population diversity
};

const DEFAULT_CONFIG: DriftMonitorConfig = {
  enabled: true,
  thresholds: DEFAULT_THRESHOLDS,
  windowSizeMs: 60000, // 1 minute window
};

class DriftDetector {
  private config: DriftMonitorConfig;
  private events: DriftEvent[] = [];
  private baseline: Map<string, number> = new Map();
  private samples: Map<string, number[]> = new Map();
  private maxEvents = 1000;

  constructor(config: Partial<DriftMonitorConfig> = {}) {
    this.config = { 
      ...DEFAULT_CONFIG, 
      ...config,
      thresholds: { ...DEFAULT_THRESHOLDS, ...config.thresholds },
    };
  }

  /**
   * Record a sample for drift analysis
   */
  recordSample(metric: string, value: number): void {
    if (!this.config.enabled) return;

    const samples = this.samples.get(metric) || [];
    samples.push(value);
    
    // Keep only samples within window
    const cutoff = Date.now() - this.config.windowSizeMs;
    // For simplicity, just keep last N samples
    if (samples.length > 100) {
      samples.shift();
    }
    
    this.samples.set(metric, samples);

    // Set baseline if not exists
    if (!this.baseline.has(metric)) {
      this.baseline.set(metric, value);
    }

    // Check for drift
    this.checkDrift(metric, value);
  }

  /**
   * Check if a metric has drifted from baseline
   */
  private checkDrift(metric: string, value: number): void {
    const baseline = this.baseline.get(metric)!;
    const samples = this.samples.get(metric) || [];
    
    if (samples.length < 5) return; // Need enough samples

    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const stdDev = Math.sqrt(
      samples.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / samples.length
    );

    // Detect anomalies (Z-score > 3)
    const zScore = Math.abs((value - avg) / (stdDev || 1));
    if (zScore > 3) {
      this.reportDrift('state_divergence', 'medium', 
        `Anomaly detected in ${metric}: value ${value.toFixed(3)} (z=${zScore.toFixed(2)})`,
        { metric, value, avg, stdDev, zScore }
      );
    }

    // Check threshold violations
    this.checkThresholdViolation(metric, value);
  }

  /**
   * Check specific threshold violations
   */
  private checkThresholdViolation(metric: string, value: number): void {
    const t = this.config.thresholds;

    switch (metric) {
      case 'fitness_delta':
        if (Math.abs(value) > t.maxFitnessDelta) {
          this.reportDrift('evolution_runaway', 'high',
            `Fitness delta exceeds threshold: ${value.toFixed(3)} > ${t.maxFitnessDelta}`,
            { metric, value, threshold: t.maxFitnessDelta }
          );
        }
        break;

      case 'mutation_rate':
        if (value > t.maxMutationRate) {
          this.reportDrift('evolution_runaway', 'medium',
            `Mutation rate exceeds threshold: ${value.toFixed(3)} > ${t.maxMutationRate}`,
            { metric, value, threshold: t.maxMutationRate }
          );
        }
        break;

      case 'memory_nodes':
        if (value > t.maxMemoryNodes) {
          this.reportDrift('memory_corruption', 'high',
            `Memory node count exceeds threshold: ${value} > ${t.maxMemoryNodes}`,
            { metric, value, threshold: t.maxMemoryNodes }
          );
        }
        break;

      case 'operation_latency':
        if (value > t.maxLatencyMs) {
          this.reportDrift('performance_anomaly', 'low',
            `Operation latency exceeds threshold: ${value.toFixed(0)}ms > ${t.maxLatencyMs}ms`,
            { metric, value, threshold: t.maxLatencyMs }
          );
        }
        break;

      case 'diversity_index':
        if (value < t.minDiversityIndex) {
          this.reportDrift('evolution_runaway', 'medium',
            `Diversity index below threshold: ${value.toFixed(3)} < ${t.minDiversityIndex}`,
            { metric, value, threshold: t.minDiversityIndex }
          );
        }
        break;
    }
  }

  /**
   * Report a drift event
   */
  reportDrift(
    type: DriftType,
    severity: DriftEvent['severity'],
    message: string,
    context: Record<string, unknown> = {}
  ): DriftEvent {
    const event: DriftEvent = {
      id: `drift_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      timestamp: Date.now(),
      severity,
      message,
      context,
      resolved: false,
    };

    this.events.push(event);

    // Prune old events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    log.warn(`Drift detected: [${type}] ${message}`, context);
    metrics.increment('drift_detected');

    // Trigger callback if configured
    if (this.config.alertCallback) {
      this.config.alertCallback(event);
    }

    return event;
  }

  /**
   * Mark a drift event as resolved
   */
  resolve(eventId: string): boolean {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return false;

    event.resolved = true;
    event.resolvedAt = Date.now();
    log.info(`Drift resolved: ${eventId}`);
    return true;
  }

  /**
   * Check for seed mismatch between two states
   */
  checkSeedMismatch(expected: string, actual: string): boolean {
    if (expected !== actual) {
      this.reportDrift('seed_mismatch', 'critical',
        `Seed mismatch detected`,
        { expected, actual }
      );
      return true;
    }
    return false;
  }

  /**
   * Check for evolution runaway conditions
   */
  checkEvolutionRunaway(
    generation: number,
    avgFitness: number,
    diversityIndex: number
  ): boolean {
    let runaway = false;

    // Check if fitness is stagnant for too long
    const prevFitness = this.baseline.get('avg_fitness');
    if (prevFitness !== undefined) {
      const delta = Math.abs(avgFitness - prevFitness);
      this.recordSample('fitness_delta', delta);
    }
    this.baseline.set('avg_fitness', avgFitness);

    // Check diversity collapse
    this.recordSample('diversity_index', diversityIndex);
    if (diversityIndex < this.config.thresholds.minDiversityIndex) {
      runaway = true;
    }

    return runaway;
  }

  /**
   * Get all unresolved drift events
   */
  getUnresolvedEvents(): DriftEvent[] {
    return this.events.filter(e => !e.resolved);
  }

  /**
   * Get events by type
   */
  getEventsByType(type: DriftType): DriftEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /**
   * Get events by severity
   */
  getEventsBySeverity(severity: DriftEvent['severity']): DriftEvent[] {
    return this.events.filter(e => e.severity === severity);
  }

  /**
   * Get recent events within time window
   */
  getRecentEvents(windowMs: number = 60000): DriftEvent[] {
    const cutoff = Date.now() - windowMs;
    return this.events.filter(e => e.timestamp >= cutoff);
  }

  /**
   * Update baseline values
   */
  updateBaseline(values: Record<string, number>): void {
    for (const [key, value] of Object.entries(values)) {
      this.baseline.set(key, value);
    }
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.events = [];
    this.baseline.clear();
    this.samples.clear();
  }

  /**
   * Get summary statistics
   */
  getSummary(): DriftSummary {
    const total = this.events.length;
    const unresolved = this.events.filter(e => !e.resolved).length;
    const bySeverity = {
      low: this.events.filter(e => e.severity === 'low').length,
      medium: this.events.filter(e => e.severity === 'medium').length,
      high: this.events.filter(e => e.severity === 'high').length,
      critical: this.events.filter(e => e.severity === 'critical').length,
    };

    return {
      total,
      unresolved,
      bySeverity,
      recent: this.getRecentEvents().length,
    };
  }
}

export interface DriftSummary {
  total: number;
  unresolved: number;
  bySeverity: Record<DriftEvent['severity'], number>;
  recent: number;
}

export const drift = new DriftDetector();
