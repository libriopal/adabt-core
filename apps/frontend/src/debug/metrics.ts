/**
 * Metrics Collection System
 * 
 * Collects, aggregates, and persists telemetry data for debugging,
 * performance monitoring, and system health tracking.
 */

import { persistence, MetricRecord } from '../storage/indexedDB';

export type MetricCategory = 'performance' | 'evolution' | 'memory' | 'error' | 'validation';

export interface MetricDefinition {
  name: string;
  category: MetricCategory;
  unit?: string;
  description?: string;
  aggregation?: 'sum' | 'avg' | 'max' | 'min' | 'count';
}

export interface AggregatedMetric {
  name: string;
  category: MetricCategory;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  lastValue: number;
  lastTimestamp: number;
}

export interface MetricSnapshot {
  timestamp: number;
  metrics: Map<string, AggregatedMetric>;
  categories: Record<MetricCategory, number>;
}

// Pre-defined AGROS metrics
export const AGROS_METRICS: MetricDefinition[] = [
  // Performance metrics
  { name: 'render_time', category: 'performance', unit: 'ms', aggregation: 'avg' },
  { name: 'prng_calls', category: 'performance', unit: 'count', aggregation: 'sum' },
  { name: 'checkpoint_size', category: 'performance', unit: 'bytes', aggregation: 'max' },
  { name: 'cache_hits', category: 'performance', unit: 'count', aggregation: 'sum' },
  { name: 'cache_misses', category: 'performance', unit: 'count', aggregation: 'sum' },
  
  // Evolution metrics
  { name: 'generation', category: 'evolution', unit: 'epoch', aggregation: 'max' },
  { name: 'population_size', category: 'evolution', unit: 'count', aggregation: 'avg' },
  { name: 'avg_fitness', category: 'evolution', unit: 'score', aggregation: 'avg' },
  { name: 'best_fitness', category: 'evolution', unit: 'score', aggregation: 'max' },
  { name: 'mutation_rate', category: 'evolution', unit: 'ratio', aggregation: 'avg' },
  { name: 'diversity_index', category: 'evolution', unit: 'score', aggregation: 'avg' },
  { name: 'selection_pressure', category: 'evolution', unit: 'ratio', aggregation: 'avg' },
  
  // Memory metrics
  { name: 'memory_nodes', category: 'memory', unit: 'count', aggregation: 'max' },
  { name: 'memory_edges', category: 'memory', unit: 'count', aggregation: 'max' },
  { name: 'compression_ratio', category: 'memory', unit: 'ratio', aggregation: 'avg' },
  { name: 'topology_changes', category: 'memory', unit: 'count', aggregation: 'sum' },
  
  // Error metrics
  { name: 'errors_total', category: 'error', unit: 'count', aggregation: 'sum' },
  { name: 'validation_failures', category: 'error', unit: 'count', aggregation: 'sum' },
  { name: 'recovery_attempts', category: 'error', unit: 'count', aggregation: 'sum' },
  
  // Validation metrics
  { name: 'integrity_checks', category: 'validation', unit: 'count', aggregation: 'sum' },
  { name: 'drift_detected', category: 'validation', unit: 'count', aggregation: 'sum' },
  { name: 'consensus_failures', category: 'validation', unit: 'count', aggregation: 'sum' },
];

class MetricsCollector {
  private buffer: MetricRecord[] = [];
  private aggregates: Map<string, AggregatedMetric> = new Map();
  private flushInterval: number | null = null;
  private enabled = true;
  private bufferSize = 100;
  private flushIntervalMs = 5000;

  constructor() {
    this.initializeAggregates();
  }

  private initializeAggregates(): void {
    for (const def of AGROS_METRICS) {
      this.aggregates.set(def.name, {
        name: def.name,
        category: def.category,
        count: 0,
        sum: 0,
        avg: 0,
        min: Infinity,
        max: -Infinity,
        lastValue: 0,
        lastTimestamp: 0,
      });
    }
  }

  /**
   * Start automatic flushing
   */
  start(): void {
    if (this.flushInterval) return;
    this.flushInterval = window.setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
    console.log('[AGROS] Metrics collector started');
  }

  /**
   * Stop automatic flushing
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Record a metric value
   */
  record(name: string, value: number, metadata?: Record<string, unknown>): void {
    if (!this.enabled) return;

    const def = AGROS_METRICS.find(m => m.name === name);
    const category = def?.category || 'performance';

    const record: Omit<MetricRecord, 'id'> = {
      timestamp: Date.now(),
      category,
      name,
      value,
      metadata,
    };

    this.buffer.push(record as MetricRecord);
    this.updateAggregate(name, category, value);

    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  /**
   * Record a timing metric
   */
  time<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    this.record(name, duration);
    return result;
  }

  /**
   * Record an async timing metric
   */
  async timeAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    this.record(name, duration);
    return result;
  }

  /**
   * Increment a counter
   */
  increment(name: string, amount = 1): void {
    const current = this.aggregates.get(name);
    this.record(name, (current?.lastValue || 0) + amount);
  }

  private updateAggregate(name: string, category: MetricCategory, value: number): void {
    let agg = this.aggregates.get(name);
    
    if (!agg) {
      agg = {
        name,
        category,
        count: 0,
        sum: 0,
        avg: 0,
        min: Infinity,
        max: -Infinity,
        lastValue: 0,
        lastTimestamp: 0,
      };
      this.aggregates.set(name, agg);
    }

    agg.count++;
    agg.sum += value;
    agg.avg = agg.sum / agg.count;
    agg.min = Math.min(agg.min, value);
    agg.max = Math.max(agg.max, value);
    agg.lastValue = value;
    agg.lastTimestamp = Date.now();
  }

  /**
   * Flush buffer to persistent storage
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const toFlush = [...this.buffer];
    this.buffer = [];

    for (const record of toFlush) {
      try {
        await persistence.recordMetric(record);
      } catch (e) {
        console.warn('[AGROS] Failed to persist metric:', e);
      }
    }
  }

  /**
   * Get current aggregate for a metric
   */
  get(name: string): AggregatedMetric | undefined {
    return this.aggregates.get(name);
  }

  /**
   * Get all aggregates
   */
  getAll(): Map<string, AggregatedMetric> {
    return new Map(this.aggregates);
  }

  /**
   * Get aggregates by category
   */
  getByCategory(category: MetricCategory): AggregatedMetric[] {
    return Array.from(this.aggregates.values())
      .filter(m => m.category === category);
  }

  /**
   * Get a snapshot of current metrics state
   */
  snapshot(): MetricSnapshot {
    const categories: Record<MetricCategory, number> = {
      performance: 0,
      evolution: 0,
      memory: 0,
      error: 0,
      validation: 0,
    };

    for (const agg of this.aggregates.values()) {
      categories[agg.category]++;
    }

    return {
      timestamp: Date.now(),
      metrics: new Map(this.aggregates),
      categories,
    };
  }

  /**
   * Load historical metrics from storage
   */
  async loadHistory(category: MetricCategory, limit = 100): Promise<MetricRecord[]> {
    return persistence.getMetricsByCategory(category, limit);
  }

  /**
   * Reset all aggregates
   */
  reset(): void {
    this.aggregates.clear();
    this.initializeAggregates();
    this.buffer = [];
  }

  /**
   * Enable/disable collection
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get formatted summary for debugging
   */
  getSummary(): string {
    const lines: string[] = [
      'AGROS Metrics Summary',
      '='.repeat(40),
    ];

    const categories: MetricCategory[] = ['performance', 'evolution', 'memory', 'error', 'validation'];

    for (const cat of categories) {
      const metrics = this.getByCategory(cat);
      if (metrics.length === 0) continue;

      lines.push(`\n[${cat.toUpperCase()}]`);
      for (const m of metrics) {
        if (m.count === 0) continue;
        lines.push(`  ${m.name}: ${m.lastValue.toFixed(2)} (avg: ${m.avg.toFixed(2)}, min: ${m.min.toFixed(2)}, max: ${m.max.toFixed(2)})`);
      }
    }

    return lines.join('\n');
  }
}

export const metrics = new MetricsCollector();
