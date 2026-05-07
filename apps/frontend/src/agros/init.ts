/**
 * AGROS System Initializer
 * 
 * Bootstraps all AGROS subsystems in correct dependency order,
 * validates system integrity, and exposes the unified system interface.
 */

import { persistence, SessionRecord } from '../storage/indexedDB';
import { registry } from '../registry/manifest';
import { checkpoints } from '../checkpoints/manager';
import { metrics } from '../debug/metrics';
import { trace, createScopedLogger } from '../debug/trace';
import { integrity } from '../struthio/integrity';
import { drift } from '../struthio/drift';
import { DeterministicPRNG } from '../utils/prng';

const log = createScopedLogger('AGROS');

export interface AGROSConfig {
  enableDebug: boolean;
  enableIntegrityLoop: boolean;
  autoMigrateStorage: boolean;
  sessionPrefix: string;
}

export interface AGROSState {
  initialized: boolean;
  sessionId: string;
  seed: string;
  prng: DeterministicPRNG;
  startTime: number;
}

const DEFAULT_CONFIG: AGROSConfig = {
  enableDebug: true,
  enableIntegrityLoop: true,
  autoMigrateStorage: true,
  sessionPrefix: 'agros',
};

class AGROSSystem {
  private config: AGROSConfig;
  private state: AGROSState | null = null;
  private initPromise: Promise<AGROSState> | null = null;

  constructor(config: Partial<AGROSConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the AGROS system
   */
  async init(): Promise<AGROSState> {
    if (this.state) return this.state;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.performInit();
    return this.initPromise;
  }

  private async performInit(): Promise<AGROSState> {
    const startTime = performance.now();
    log.info('Initializing AGROS system...');

    try {
      // Phase 1: Initialize persistence
      await trace.withSpanAsync({ operation: 'init:persistence' }, async () => {
        await persistence.init();
        
        if (this.config.autoMigrateStorage) {
          await persistence.migrateFromLocalStorage();
        }
      });

      // Phase 2: Initialize or restore session
      const session = await trace.withSpanAsync({ operation: 'init:session' }, async () => {
        return this.initSession();
      });

      // Phase 3: Initialize architecture registry
      await trace.withSpanAsync({ operation: 'init:registry' }, async () => {
        await registry.init();
        const errors = await registry.validate();
        if (errors.length > 0) {
          log.warn('Architecture validation warnings', { errors });
        }
      });

      // Phase 4: Initialize checkpoint manager
      await trace.withSpanAsync({ operation: 'init:checkpoints' }, async () => {
        checkpoints.setSession(session.id);
      });

      // Phase 5: Start metrics collection
      if (this.config.enableDebug) {
        metrics.start();
      }

      // Phase 6: Start integrity loop
      if (this.config.enableIntegrityLoop) {
        integrity.start();
      }

      // Create PRNG from session seed
      const prng = new DeterministicPRNG(this.hashSeed(session.seed));

      this.state = {
        initialized: true,
        sessionId: session.id,
        seed: session.seed,
        prng,
        startTime: Date.now(),
      };

      const duration = performance.now() - startTime;
      log.info(`AGROS initialized in ${duration.toFixed(2)}ms`, {
        sessionId: session.id,
        seed: session.seed.slice(0, 16) + '...',
      });

      metrics.record('render_time', duration);

      return this.state;
    } catch (error) {
      log.critical('AGROS initialization failed', error);
      throw error;
    }
  }

  /**
   * Initialize or restore a session
   */
  private async initSession(): Promise<SessionRecord> {
    // Try to restore existing session
    const existing = await persistence.getLatestSession();
    
    if (existing) {
      // Update last active time
      existing.lastActiveAt = Date.now();
      await persistence.saveSession(existing);
      log.info('Session restored', { id: existing.id });
      return existing;
    }

    // Create new session
    const seed = this.generateSeed();
    const session: SessionRecord = {
      id: `${this.config.sessionPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      seed,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      prngState: this.hashSeed(seed),
    };

    await persistence.saveSession(session);
    log.info('New session created', { id: session.id });

    // Also store in localStorage for quick access
    localStorage.setItem('agros_session', JSON.stringify({
      seed: session.seed,
      createdAt: session.createdAt,
    }));

    return session;
  }

  /**
   * Generate a cryptographically-informed seed
   */
  private generateSeed(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hash seed to numeric PRNG state
   */
  private hashSeed(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get current state
   */
  getState(): AGROSState | null {
    return this.state;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.state?.initialized ?? false;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    if (!this.state) throw new Error('AGROS not initialized');
    return this.state.sessionId;
  }

  /**
   * Get PRNG instance
   */
  getPRNG(): DeterministicPRNG {
    if (!this.state) throw new Error('AGROS not initialized');
    return this.state.prng;
  }

  /**
   * Create a checkpoint of current state
   */
  async createCheckpoint(
    epoch: number,
    evolutionState: Parameters<typeof checkpoints.createCheckpoint>[3]
  ): Promise<void> {
    if (!this.state) throw new Error('AGROS not initialized');
    
    await checkpoints.createCheckpoint(
      this.state.sessionId,
      epoch,
      this.state.prng.getState(),
      evolutionState
    );
  }

  /**
   * Restore from a checkpoint
   */
  async restoreCheckpoint(checkpointId: string): Promise<boolean> {
    const result = await checkpoints.restore(checkpointId);
    
    if (result.success && result.prng) {
      this.state!.prng = result.prng;
      log.info('Restored from checkpoint', { checkpointId });
      return true;
    }

    log.error('Checkpoint restore failed', { errors: result.errors });
    return false;
  }

  /**
   * Run integrity check
   */
  async checkIntegrity(): Promise<boolean> {
    const report = await integrity.runChecks();
    return report.overallStatus === 'healthy';
  }

  /**
   * Get system summary for debugging
   */
  getSummary(): string {
    if (!this.state) return 'AGROS not initialized';

    const topology = registry.getTopology();
    const integrityStatus = integrity.getStatus();
    const driftSummary = drift.getSummary();

    return [
      '=== AGROS System Summary ===',
      `Session: ${this.state.sessionId}`,
      `Uptime: ${((Date.now() - this.state.startTime) / 1000).toFixed(1)}s`,
      `PRNG State: ${this.state.prng.getState()}`,
      '',
      `Architecture: v${topology?.version || 'unknown'}`,
      `Integrity: ${integrityStatus}`,
      `Drift Events: ${driftSummary.unresolved} unresolved`,
      '',
      metrics.getSummary(),
    ].join('\n');
  }

  /**
   * Shutdown AGROS gracefully
   */
  async shutdown(): Promise<void> {
    log.info('Shutting down AGROS...');
    
    // Flush metrics
    await metrics.flush();
    metrics.stop();

    // Stop integrity loop
    integrity.stop();

    // Clear state
    this.state = null;
    this.initPromise = null;

    log.info('AGROS shutdown complete');
  }
}

// Singleton instance
export const agros = new AGROSSystem();

// React hook for AGROS
export function useAGROS() {
  return {
    init: () => agros.init(),
    getState: () => agros.getState(),
    getSessionId: () => agros.getSessionId(),
    getPRNG: () => agros.getPRNG(),
    createCheckpoint: agros.createCheckpoint.bind(agros),
    restoreCheckpoint: agros.restoreCheckpoint.bind(agros),
    checkIntegrity: agros.checkIntegrity.bind(agros),
    getSummary: agros.getSummary.bind(agros),
    shutdown: agros.shutdown.bind(agros),
  };
}
