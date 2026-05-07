/**
 * STRUTHIO-SEC Consensus Validator
 *
 * Compares deterministic observations from independent loops and records
 * whether they agree on the current continuity state.
 */

import { createScopedLogger } from '../debug/trace';
import { metrics } from '../debug/metrics';

const log = createScopedLogger('CONSENSUS');

export interface ConsensusObservation {
  source: string;
  checksum: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface ConsensusReport {
  timestamp: number;
  agreed: boolean;
  canonicalChecksum: string;
  observations: ConsensusObservation[];
  conflicts: ConsensusObservation[];
}

class ConsensusValidator {
  private lastReport: ConsensusReport | null = null;

  validate(observations: ConsensusObservation[]): ConsensusReport {
    const weighted = observations.map(observation => ({
      ...observation,
      weight: observation.weight ?? 1,
    }));

    const weightByChecksum = new Map<string, number>();
    for (const observation of weighted) {
      weightByChecksum.set(
        observation.checksum,
        (weightByChecksum.get(observation.checksum) || 0) + observation.weight,
      );
    }

    const canonicalChecksum = Array.from(weightByChecksum.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || '';

    const conflicts = weighted.filter(observation => observation.checksum !== canonicalChecksum);
    const report: ConsensusReport = {
      timestamp: Date.now(),
      agreed: conflicts.length === 0,
      canonicalChecksum,
      observations: weighted,
      conflicts,
    };

    if (!report.agreed) {
      metrics.increment('consensus_failures');
      log.warn(`Consensus conflict detected: ${conflicts.length} conflicting observations`);
    }

    this.lastReport = report;
    return report;
  }

  getLastReport(): ConsensusReport | null {
    return this.lastReport;
  }
}

export const consensus = new ConsensusValidator();
