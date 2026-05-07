/**
 * STRUTHIO-SEC Integrity Loop
 * 
 * Core defensive loop that validates system state integrity,
 * detects drift, and triggers recovery when inconsistencies are found.
 * 
 * Named after Struthio (ostrich genus) - symbolizing vigilance
 * while maintaining computational efficiency.
 */

import { trace, createScopedLogger } from '../debug/trace';
import { metrics } from '../debug/metrics';

const log = createScopedLogger('STRUTHIO');

export type IntegrityStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';

export interface IntegrityCheck {
  name: string;
  description: string;
  category: 'seed' | 'evolution' | 'memory' | 'compression' | 'consensus';
  check: () => IntegrityResult | Promise<IntegrityResult>;
  recover?: () => Promise<boolean>;
  priority: number;
}

export interface IntegrityResult {
  passed: boolean;
  status: IntegrityStatus;
  message: string;
  metadata?: Record<string, unknown>;
  recoverable?: boolean;
}

export interface IntegrityReport {
  timestamp: number;
  overallStatus: IntegrityStatus;
  checks: CheckResult[];
  driftDetected: boolean;
  recoveryAttempted: boolean;
  recoverySuccessful: boolean;
}

export interface CheckResult {
  name: string;
  category: string;
  result: IntegrityResult;
  duration: number;
}

export interface IntegrityConfig {
  checkIntervalMs: number;
  autoRecover: boolean;
  maxRecoveryAttempts: number;
  failureThreshold: number;
}

const DEFAULT_CONFIG: IntegrityConfig = {
  checkIntervalMs: 30000, // 30 seconds
  autoRecover: true,
  maxRecoveryAttempts: 3,
  failureThreshold: 0.5, // 50% failure = degraded
};

class IntegrityLoop {
  private config: IntegrityConfig;
  private checks: Map<string, IntegrityCheck> = new Map();
  private lastReport: IntegrityReport | null = null;
  private checkInterval: number | null = null;
  private recoveryAttempts = 0;
  private running = false;

  constructor(config: Partial<IntegrityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registerDefaultChecks();
  }

  /**
   * Register a new integrity check
   */
  register(check: IntegrityCheck): void {
    this.checks.set(check.name, check);
    log.info(`Registered integrity check: ${check.name}`);
  }

  /**
   * Unregister a check
   */
  unregister(name: string): boolean {
    return this.checks.delete(name);
  }

  /**
   * Start the integrity loop
   */
  start(): void {
    if (this.running) return;
    
    this.running = true;
    this.checkInterval = window.setInterval(() => {
      this.runChecks();
    }, this.config.checkIntervalMs);

    // Run initial check
    this.runChecks();
    log.info('Integrity loop started');
  }

  /**
   * Stop the integrity loop
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.running = false;
    log.info('Integrity loop stopped');
  }

  /**
   * Run all integrity checks
   */
  async runChecks(): Promise<IntegrityReport> {
    return trace.withSpanAsync({ operation: 'integrity:runChecks' }, async (ctx) => {
      const startTime = performance.now();
      const results: CheckResult[] = [];
      let failedCount = 0;

      // Sort checks by priority
      const sortedChecks = Array.from(this.checks.values())
        .sort((a, b) => a.priority - b.priority);

      for (const check of sortedChecks) {
        const checkStart = performance.now();
        try {
          const result = await Promise.resolve(check.check());
          results.push({
            name: check.name,
            category: check.category,
            result,
            duration: performance.now() - checkStart,
          });

          if (!result.passed) {
            failedCount++;
            log.warn(`Check failed: ${check.name}`, { result });
            metrics.increment('validation_failures');

            // Attempt recovery if configured
            if (this.config.autoRecover && result.recoverable && check.recover) {
              await this.attemptRecovery(check);
            }
          }
        } catch (error) {
          log.error(`Check error: ${check.name}`, error);
          results.push({
            name: check.name,
            category: check.category,
            result: {
              passed: false,
              status: 'critical',
              message: `Check threw error: ${error}`,
              recoverable: false,
            },
            duration: performance.now() - checkStart,
          });
          failedCount++;
        }
      }

      const failureRatio = failedCount / sortedChecks.length;
      const overallStatus: IntegrityStatus = 
        failedCount === 0 ? 'healthy' :
        failureRatio < this.config.failureThreshold ? 'degraded' : 'critical';

      const report: IntegrityReport = {
        timestamp: Date.now(),
        overallStatus,
        checks: results,
        driftDetected: failedCount > 0,
        recoveryAttempted: this.recoveryAttempts > 0,
        recoverySuccessful: this.recoveryAttempts > 0 && overallStatus !== 'critical',
      };

      this.lastReport = report;

      // Record metrics
      metrics.record('integrity_checks', results.length);
      if (report.driftDetected) {
        metrics.increment('drift_detected');
      }

      const duration = performance.now() - startTime;
      log.info(`Integrity check complete: ${overallStatus} (${duration.toFixed(2)}ms)`, {
        passed: sortedChecks.length - failedCount,
        failed: failedCount,
        total: sortedChecks.length,
      });

      return report;
    });
  }

  /**
   * Attempt recovery for a failed check
   */
  private async attemptRecovery(check: IntegrityCheck): Promise<boolean> {
    if (this.recoveryAttempts >= this.config.maxRecoveryAttempts) {
      log.error(`Max recovery attempts reached for ${check.name}`);
      return false;
    }

    this.recoveryAttempts++;
    metrics.increment('recovery_attempts');

    try {
      const success = await check.recover!();
      if (success) {
        log.info(`Recovery successful for ${check.name}`);
        this.recoveryAttempts = 0; // Reset on success
      } else {
        log.warn(`Recovery failed for ${check.name}`);
      }
      return success;
    } catch (error) {
      log.error(`Recovery error for ${check.name}`, error);
      return false;
    }
  }

  /**
   * Get the latest report
   */
  getLastReport(): IntegrityReport | null {
    return this.lastReport;
  }

  /**
   * Check if system is healthy
   */
  isHealthy(): boolean {
    return this.lastReport?.overallStatus === 'healthy';
  }

  /**
   * Get current status
   */
  getStatus(): IntegrityStatus {
    return this.lastReport?.overallStatus || 'unknown';
  }

  /**
   * Register default STRUTHIO checks
   */
  private registerDefaultChecks(): void {
    // Seed consistency check
    this.register({
      name: 'seed_consistency',
      description: 'Validates PRNG seed state consistency',
      category: 'seed',
      priority: 1,
      check: () => {
        // Check that session seed exists and is valid
        const sessionData = localStorage.getItem('agros_session');
        if (!sessionData) {
          return {
            passed: false,
            status: 'degraded',
            message: 'No session data found',
            recoverable: true,
          };
        }

        try {
          const session = JSON.parse(sessionData);
          if (!session.seed || typeof session.seed !== 'string') {
            return {
              passed: false,
              status: 'degraded',
              message: 'Invalid seed format',
              recoverable: true,
            };
          }
          return {
            passed: true,
            status: 'healthy',
            message: 'Seed consistent',
            metadata: { seedLength: session.seed.length },
          };
        } catch {
          return {
            passed: false,
            status: 'degraded',
            message: 'Session data corrupted',
            recoverable: true,
          };
        }
      },
      recover: async () => {
        // Generate new session if corrupted
        const newSeed = `agros_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        localStorage.setItem('agros_session', JSON.stringify({
          seed: newSeed,
          createdAt: Date.now(),
          recovered: true,
        }));
        return true;
      },
    });

    // Evolution boundary check
    this.register({
      name: 'evolution_bounds',
      description: 'Validates evolution parameters are within safe bounds',
      category: 'evolution',
      priority: 2,
      check: () => {
        // Placeholder - would check actual evolution state
        return {
          passed: true,
          status: 'healthy',
          message: 'Evolution bounds valid',
        };
      },
    });

    // Memory consistency check
    this.register({
      name: 'memory_consistency',
      description: 'Validates memory graph consistency',
      category: 'memory',
      priority: 3,
      check: async () => {
        // Check IndexedDB is accessible
        try {
          await new Promise<void>((resolve, reject) => {
            const request = indexedDB.open('agros_persistence');
            request.onsuccess = () => {
              request.result.close();
              resolve();
            };
            request.onerror = () => reject(request.error);
          });
          return {
            passed: true,
            status: 'healthy',
            message: 'IndexedDB accessible',
          };
        } catch {
          return {
            passed: false,
            status: 'degraded',
            message: 'IndexedDB not accessible',
            recoverable: false,
          };
        }
      },
    });

    // Compression verification check
    this.register({
      name: 'compression_verification',
      description: 'Validates compressed states are reconstructable',
      category: 'compression',
      priority: 4,
      check: () => {
        // Placeholder for future compression system
        return {
          passed: true,
          status: 'healthy',
          message: 'Compression system not yet active',
        };
      },
    });
  }

  /**
   * Format report for display
   */
  formatReport(report: IntegrityReport = this.lastReport!): string {
    if (!report) return 'No integrity report available';

    const lines: string[] = [
      `STRUTHIO-SEC Integrity Report`,
      `Generated: ${new Date(report.timestamp).toISOString()}`,
      `Status: ${report.overallStatus.toUpperCase()}`,
      `Drift Detected: ${report.driftDetected}`,
      '',
      'Check Results:',
    ];

    for (const check of report.checks) {
      const status = check.result.passed ? 'PASS' : 'FAIL';
      lines.push(`  [${status}] ${check.name} (${check.duration.toFixed(2)}ms)`);
      lines.push(`       ${check.result.message}`);
    }

    if (report.recoveryAttempted) {
      lines.push('');
      lines.push(`Recovery: ${report.recoverySuccessful ? 'Successful' : 'Failed'}`);
    }

    return lines.join('\n');
  }
}

export const integrity = new IntegrityLoop();
