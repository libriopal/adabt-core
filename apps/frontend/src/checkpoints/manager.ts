/**
 * Checkpoint/Snapshot System
 * 
 * Enables resumable evolution by capturing full system state at critical points.
 * Supports:
 * - Auto-checkpointing at epoch boundaries
 * - Manual checkpoint creation
 * - State reconstruction from checkpoint
 * - Checkpoint validation and integrity verification
 * - Rollback to previous valid state
 */

import { 
  persistence, 
  CheckpointRecord, 
  EvolutionSnapshot, 
  MemorySnapshot, 
  VariantRecord,
  MutationRecord,
  SessionRecord 
} from '../storage/indexedDB';
import { DeterministicPRNG } from '../utils/prng';

export interface CheckpointConfig {
  autoCheckpointInterval: number;  // Epochs between auto-checkpoints
  maxCheckpointsPerSession: number;
  validateOnRestore: boolean;
  pruneOldCheckpoints: boolean;
}

export interface RestoreResult {
  success: boolean;
  checkpoint?: CheckpointRecord;
  prng?: DeterministicPRNG;
  errors?: string[];
}

export interface CheckpointSummary {
  id: string;
  timestamp: number;
  epoch: number;
  populationSize: number;
  avgFitness: number;
  validated: boolean;
}

const DEFAULT_CONFIG: CheckpointConfig = {
  autoCheckpointInterval: 10,
  maxCheckpointsPerSession: 50,
  validateOnRestore: true,
  pruneOldCheckpoints: true,
};

class CheckpointManager {
  private config: CheckpointConfig;
  private currentSessionId: string | null = null;
  private lastEpoch = 0;

  constructor(config: Partial<CheckpointConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setSession(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  /**
   * Create a checkpoint of the current system state
   */
  async createCheckpoint(
    sessionId: string,
    epoch: number,
    prngState: number,
    evolutionState: EvolutionSnapshot,
    memoryState: MemorySnapshot = this.createEmptyMemoryState()
  ): Promise<CheckpointRecord> {
    const checkpoint: CheckpointRecord = {
      id: `ckpt_${sessionId}_${epoch}_${Date.now()}`,
      sessionId,
      timestamp: Date.now(),
      epoch,
      prngState,
      evolutionState,
      memoryState,
      validated: false,
    };

    // Validate before saving
    checkpoint.validated = this.validateCheckpoint(checkpoint);

    await persistence.saveCheckpoint(checkpoint);

    // Prune old checkpoints if configured
    if (this.config.pruneOldCheckpoints) {
      await this.pruneCheckpoints(sessionId);
    }

    this.lastEpoch = epoch;
    console.log(`[AGROS] Checkpoint created: ${checkpoint.id} (epoch ${epoch})`);

    return checkpoint;
  }

  /**
   * Check if auto-checkpoint should trigger
   */
  shouldAutoCheckpoint(currentEpoch: number): boolean {
    return currentEpoch > 0 && 
           currentEpoch % this.config.autoCheckpointInterval === 0 &&
           currentEpoch !== this.lastEpoch;
  }

  /**
   * Restore system state from a checkpoint
   */
  async restore(checkpointId: string): Promise<RestoreResult> {
    const checkpoint = await persistence.getCheckpoint(checkpointId);
    
    if (!checkpoint) {
      return {
        success: false,
        errors: [`Checkpoint not found: ${checkpointId}`],
      };
    }

    // Validate if configured
    if (this.config.validateOnRestore && !checkpoint.validated) {
      const isValid = this.validateCheckpoint(checkpoint);
      if (!isValid) {
        return {
          success: false,
          checkpoint,
          errors: ['Checkpoint validation failed'],
        };
      }
    }

    // Reconstruct PRNG with stored state
    const prng = new DeterministicPRNG(checkpoint.prngState);

    this.lastEpoch = checkpoint.epoch;
    this.currentSessionId = checkpoint.sessionId;

    return {
      success: true,
      checkpoint,
      prng,
    };
  }

  /**
   * Restore to the latest valid checkpoint for a session
   */
  async restoreLatest(sessionId: string): Promise<RestoreResult> {
    const checkpoints = await persistence.getSessionCheckpoints(sessionId);
    
    // Sort by epoch descending, find first valid
    const sorted = checkpoints.sort((a, b) => b.epoch - a.epoch);
    
    for (const ckpt of sorted) {
      if (ckpt.validated || this.validateCheckpoint(ckpt)) {
        return this.restore(ckpt.id);
      }
    }

    return {
      success: false,
      errors: ['No valid checkpoints found for session'],
    };
  }

  /**
   * Validate checkpoint integrity
   */
  validateCheckpoint(checkpoint: CheckpointRecord): boolean {
    const errors: string[] = [];

    // Check required fields
    if (!checkpoint.id || !checkpoint.sessionId) {
      errors.push('Missing required identifiers');
    }

    // Validate evolution state
    const evo = checkpoint.evolutionState;
    if (!evo) {
      errors.push('Missing evolution state');
    } else {
      if (!Array.isArray(evo.population) || evo.population.length === 0) {
        errors.push('Invalid or empty population');
      }

      if (typeof evo.generation !== 'number' || evo.generation < 0) {
        errors.push('Invalid generation number');
      }

      // Validate each variant
      for (const variant of evo.population || []) {
        if (!this.validateVariant(variant)) {
          errors.push(`Invalid variant: ${variant.id}`);
        }
      }

      // Check fitness history consistency
      if (evo.fitnessHistory && evo.fitnessHistory.length !== evo.generation + 1) {
        // Warning but not fatal
        console.warn('[AGROS] Fitness history length mismatch');
      }
    }

    // Validate PRNG state
    if (typeof checkpoint.prngState !== 'number') {
      errors.push('Invalid PRNG state');
    }

    if (errors.length > 0) {
      console.warn('[AGROS] Checkpoint validation errors:', errors);
      return false;
    }

    return true;
  }

  private validateVariant(variant: VariantRecord): boolean {
    if (!variant.id || typeof variant.id !== 'string') return false;
    if (typeof variant.fitness !== 'number') return false;
    if (!variant.genome || typeof variant.genome !== 'object') return false;
    if (!Array.isArray(variant.lineage)) return false;
    return true;
  }

  /**
   * Get all checkpoints for a session as summaries
   */
  async listCheckpoints(sessionId: string): Promise<CheckpointSummary[]> {
    const checkpoints = await persistence.getSessionCheckpoints(sessionId);
    
    return checkpoints.map(ckpt => ({
      id: ckpt.id,
      timestamp: ckpt.timestamp,
      epoch: ckpt.epoch,
      populationSize: ckpt.evolutionState?.population?.length || 0,
      avgFitness: this.computeAvgFitness(ckpt.evolutionState),
      validated: ckpt.validated,
    })).sort((a, b) => b.epoch - a.epoch);
  }

  private computeAvgFitness(evo: EvolutionSnapshot | undefined): number {
    if (!evo?.population?.length) return 0;
    const sum = evo.population.reduce((acc, v) => acc + v.fitness, 0);
    return sum / evo.population.length;
  }

  /**
   * Create a diff between two checkpoints
   */
  async diffCheckpoints(ckptId1: string, ckptId2: string): Promise<CheckpointDiff | null> {
    const [ckpt1, ckpt2] = await Promise.all([
      persistence.getCheckpoint(ckptId1),
      persistence.getCheckpoint(ckptId2),
    ]);

    if (!ckpt1 || !ckpt2) return null;

    const populationDiff = this.diffPopulations(
      ckpt1.evolutionState.population,
      ckpt2.evolutionState.population
    );

    return {
      epochDelta: ckpt2.epoch - ckpt1.epoch,
      timeDelta: ckpt2.timestamp - ckpt1.timestamp,
      fitnessChange: this.computeAvgFitness(ckpt2.evolutionState) - this.computeAvgFitness(ckpt1.evolutionState),
      populationChange: ckpt2.evolutionState.population.length - ckpt1.evolutionState.population.length,
      newVariants: populationDiff.added,
      removedVariants: populationDiff.removed,
      mutationCount: (ckpt2.evolutionState.mutationLog?.length || 0) - (ckpt1.evolutionState.mutationLog?.length || 0),
    };
  }

  private diffPopulations(
    pop1: VariantRecord[],
    pop2: VariantRecord[]
  ): { added: string[]; removed: string[] } {
    const ids1 = new Set(pop1.map(v => v.id));
    const ids2 = new Set(pop2.map(v => v.id));

    return {
      added: [...ids2].filter(id => !ids1.has(id)),
      removed: [...ids1].filter(id => !ids2.has(id)),
    };
  }

  /**
   * Prune old checkpoints, keeping only the most recent N
   */
  private async pruneCheckpoints(sessionId: string): Promise<number> {
    const checkpoints = await persistence.getSessionCheckpoints(sessionId);
    
    if (checkpoints.length <= this.config.maxCheckpointsPerSession) {
      return 0;
    }

    // Sort by epoch descending
    const sorted = checkpoints.sort((a, b) => b.epoch - a.epoch);
    const toDelete = sorted.slice(this.config.maxCheckpointsPerSession);

    // Note: actual deletion would require adding a delete method to persistence
    // For now, we just log
    console.log(`[AGROS] Would prune ${toDelete.length} old checkpoints`);

    return toDelete.length;
  }

  /**
   * Create snapshot from current evolution state
   */
  createEvolutionSnapshot(
    generation: number,
    population: VariantRecord[],
    fitnessHistory: number[],
    mutationLog: MutationRecord[],
    selectionPressure: number
  ): EvolutionSnapshot {
    return {
      generation,
      population: JSON.parse(JSON.stringify(population)), // Deep clone
      fitnessHistory: [...fitnessHistory],
      mutationLog: [...mutationLog],
      selectionPressure,
    };
  }

  /**
   * Create empty memory state (placeholder for future memory system)
   */
  private createEmptyMemoryState(): MemorySnapshot {
    return {
      nodes: [],
      edges: [],
      compressionLevel: 0,
      topologyHash: '00000000',
    };
  }

  /**
   * Export checkpoint as JSON for external backup
   */
  async exportCheckpoint(checkpointId: string): Promise<string | null> {
    const checkpoint = await persistence.getCheckpoint(checkpointId);
    if (!checkpoint) return null;

    return JSON.stringify({
      exportedAt: Date.now(),
      version: '1.0',
      checkpoint,
    }, null, 2);
  }

  /**
   * Import checkpoint from JSON
   */
  async importCheckpoint(json: string): Promise<CheckpointRecord | null> {
    try {
      const data = JSON.parse(json);
      const checkpoint = data.checkpoint as CheckpointRecord;
      
      if (!this.validateCheckpoint(checkpoint)) {
        console.error('[AGROS] Imported checkpoint failed validation');
        return null;
      }

      // Generate new ID to avoid conflicts
      checkpoint.id = `ckpt_import_${Date.now()}`;
      await persistence.saveCheckpoint(checkpoint);
      
      return checkpoint;
    } catch (e) {
      console.error('[AGROS] Failed to import checkpoint:', e);
      return null;
    }
  }
}

export interface CheckpointDiff {
  epochDelta: number;
  timeDelta: number;
  fitnessChange: number;
  populationChange: number;
  newVariants: string[];
  removedVariants: string[];
  mutationCount: number;
}

export const checkpoints = new CheckpointManager();
