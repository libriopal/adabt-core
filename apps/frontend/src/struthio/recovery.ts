/**
 * STRUTHIO-SEC Recovery Engine
 *
 * Captures bounded browser-side recovery checkpoints and verifies that a
 * checkpoint can be restored without losing deterministic seed context.
 */

import { createScopedLogger } from '../debug/trace';
import { metrics } from '../debug/metrics';

const log = createScopedLogger('RECOVERY');

export interface RecoveryCheckpoint {
  id: string;
  seed: string;
  timestamp: number;
  topologyChecksum: string;
  state: Record<string, unknown>;
}

export interface RecoveryResult {
  checkpointId: string;
  restored: boolean;
  checksum: string;
  message: string;
}

class RecoveryEngine {
  private checkpoints = new Map<string, RecoveryCheckpoint>();
  private maxCheckpoints = 20;

  createCheckpoint(seed: string, state: Record<string, unknown>): RecoveryCheckpoint {
    const serialized = JSON.stringify({ seed, state });
    const topologyChecksum = this.hash(serialized);
    const checkpoint: RecoveryCheckpoint = {
      id: `recovery_${topologyChecksum}`,
      seed,
      timestamp: Date.now(),
      topologyChecksum,
      state,
    };

    this.checkpoints.set(checkpoint.id, checkpoint);
    this.trim();
    metrics.record('checkpoint_size', serialized.length);
    log.info(`Recovery checkpoint created: ${checkpoint.id}`);
    return checkpoint;
  }

  restore(checkpointId: string): RecoveryResult {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      metrics.increment('recovery_attempts');
      return {
        checkpointId,
        restored: false,
        checksum: '',
        message: 'Checkpoint not found in active recovery registry',
      };
    }

    const checksum = this.hash(JSON.stringify({ seed: checkpoint.seed, state: checkpoint.state }));
    const restored = checksum === checkpoint.topologyChecksum;
    metrics.increment('recovery_attempts');

    return {
      checkpointId,
      restored,
      checksum,
      message: restored
        ? 'Checkpoint restored with deterministic seed parity'
        : 'Checkpoint checksum mismatch',
    };
  }

  listCheckpoints(): RecoveryCheckpoint[] {
    return Array.from(this.checkpoints.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  clear(): void {
    this.checkpoints.clear();
  }

  private trim(): void {
    const checkpoints = this.listCheckpoints();
    for (const checkpoint of checkpoints.slice(this.maxCheckpoints)) {
      this.checkpoints.delete(checkpoint.id);
    }
  }

  private hash(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
}

export const recovery = new RecoveryEngine();
