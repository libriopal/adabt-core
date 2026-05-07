import {
  CocoonReplaySummary,
  CocoonState,
  ReconstructionValidationReport,
} from './types';
import {
  createCocoonState,
  deserializeCocoonState,
  serializeCocoonState,
} from './serializer';
import { stableHash } from './semanticGraph';

const CONTINUITY_BOUNDARY = 0.82;

export function verifyCocoonReplay(seed = 'agros-phase-6-cocoon'): CocoonReplaySummary {
  const first = createCocoonState(seed);
  const second = createCocoonState(seed);
  const firstChecksum = checksumCocoon(first);
  const secondChecksum = checksumCocoon(second);
  const reconstruction = verifyReconstruction(first);

  return {
    stable: firstChecksum === secondChecksum && reconstruction.stable,
    checksum: firstChecksum,
    firstChecksum,
    secondChecksum,
    reconstruction,
    continuity: first.metadata.continuity,
    metrics: first.metadata.metrics,
    topology: first.encoding.topology,
  };
}

export function verifyReconstruction(cocoon: CocoonState): ReconstructionValidationReport {
  const serialized = serializeCocoonState(cocoon);
  const reconstructed = deserializeCocoonState(serialized);
  const reconstructedChecksum = checksumCocoon(reconstructed);
  const originalChecksum = checksumCocoon(cocoon);
  const errors: string[] = [];

  if (reconstructedChecksum !== originalChecksum) {
    errors.push('serialized cocoon checksum changed during reconstruction');
  }

  if (reconstructed.graph.topologySignature !== cocoon.graph.topologySignature) {
    errors.push('semantic topology signature mismatch');
  }

  if (reconstructed.encoding.topology.checksum !== cocoon.encoding.topology.checksum) {
    errors.push('manifold topology checksum mismatch');
  }

  if (reconstructed.metadata.continuity.overall < CONTINUITY_BOUNDARY) {
    errors.push('continuity score below reconstruction boundary');
  }

  if (reconstructed.metadata.metrics.entropyAfter > reconstructed.metadata.metrics.entropyBefore) {
    errors.push('entropy accounting increased after compression');
  }

  const accuracy = calculateAccuracy(cocoon, reconstructed, errors);

  return {
    stable: errors.length === 0,
    accuracy,
    deterministic: reconstructedChecksum === originalChecksum,
    topologyMatch: reconstructed.graph.topologySignature === cocoon.graph.topologySignature,
    continuityPreserved: reconstructed.metadata.continuity.overall >= CONTINUITY_BOUNDARY,
    entropyAccounted: reconstructed.metadata.metrics.entropyAfter <= reconstructed.metadata.metrics.entropyBefore,
    checksum: reconstructedChecksum,
    errors,
  };
}

export function checksumCocoon(cocoon: CocoonState): string {
  return stableHash(serializeCocoonState(cocoon));
}

function calculateAccuracy(
  original: CocoonState,
  reconstructed: CocoonState,
  errors: string[],
): number {
  const checks = [
    reconstructed.id === original.id,
    reconstructed.checksum === original.checksum,
    reconstructed.graph.topologySignature === original.graph.topologySignature,
    reconstructed.encoding.topology.checksum === original.encoding.topology.checksum,
    reconstructed.identityState.continuityChecksum === original.identityState.continuityChecksum,
    reconstructed.reinforcementLineage.checksum === original.reinforcementLineage.checksum,
    reconstructed.recovery.checkpointId === original.recovery.checkpointId,
    errors.length === 0,
  ];

  return Number((checks.filter(Boolean).length / checks.length).toFixed(4));
}
