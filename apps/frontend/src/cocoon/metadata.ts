import {
  CompressionMetadataRecord,
  CompressionMetrics,
  ContinuityScore,
  RecoveryManifest,
  SemanticAnchor,
  SemanticGraphAbstraction,
} from './types';
import { round, stableHash } from './semanticGraph';

const CONTINUITY_ANCHORS = {
  emotional: 'emotional-continuity',
  reasoning: 'reasoning-continuity',
  identity: 'determinism',
  architecture: 'architectural-intent',
  reinforcement: 'reinforcement-lineage',
} as const;

export function calculateCompressionMetrics(graph: SemanticGraphAbstraction, serializedUnits: number): CompressionMetrics {
  const originalUnits = graph.nodes.length + graph.edges.length;
  const compressionRatio = round(serializedUnits / Math.max(originalUnits, 1));
  const entropyBefore = calculateEntropy(graph.nodes.map(node => node.weight));
  const topologyMass = graph.edges.reduce((sum, edge) => sum + edge.weight, 0) / Math.max(graph.edges.length, 1);
  const entropyAfter = round(entropyBefore * compressionRatio * (1 - Math.min(topologyMass, 1) * 0.18));

  return {
    originalUnits,
    serializedUnits,
    compressionRatio,
    entropyBefore,
    entropyAfter,
    entropyDelta: round(entropyBefore - entropyAfter),
    semanticLoss: round(Math.max(0, compressionRatio - 0.5) * 0.2),
    topologyPreservation: round(Math.min(1, topologyMass)),
  };
}

export function calculateContinuityScore(graph: SemanticGraphAbstraction): ContinuityScore {
  const scores = {
    emotional: anchorScore(graph, CONTINUITY_ANCHORS.emotional),
    reasoning: anchorScore(graph, CONTINUITY_ANCHORS.reasoning),
    identity: anchorScore(graph, CONTINUITY_ANCHORS.identity),
    architecture: anchorScore(graph, CONTINUITY_ANCHORS.architecture),
    reinforcement: anchorScore(graph, CONTINUITY_ANCHORS.reinforcement),
  };

  return {
    ...scores,
    overall: round(Object.values(scores).reduce((sum, value) => sum + value, 0) / Object.values(scores).length),
  };
}

export function createRecoveryManifest(graph: SemanticGraphAbstraction): RecoveryManifest {
  const rebuildOrder = [...graph.nodes]
    .sort((a, b) => a.priority - b.priority || b.weight - a.weight || a.id.localeCompare(b.id))
    .map(node => node.id);

  return {
    checkpointId: `recovery_${stableHash(graph.topologySignature)}`,
    rollbackTarget: rebuildOrder[0],
    rebuildOrder,
    requiredAnchors: [
      'determinism',
      'emotional-continuity',
      'reasoning-continuity',
      'architectural-intent',
      'semantic-topology',
      'reinforcement-lineage',
    ],
    validationBoundaries: [
      'checksum parity must match across replay',
      'topology checksum must match encoded graph',
      'continuity score must remain at or above 0.82',
      'entropy after compression must not exceed entropy before compression',
    ],
    reconstructionHints: [
      'restore deterministic seed identity first',
      'rebuild topology edges before manifold geodesics',
      'inherit reinforcement lineage after semantic topology is restored',
      'validate entropy accounting before accepting the cocoon checkpoint',
    ],
  };
}

export function createMetadataRecord(
  graph: SemanticGraphAbstraction,
  metrics: CompressionMetrics,
  continuity: ContinuityScore,
  recovery: RecoveryManifest,
): CompressionMetadataRecord {
  const checksum = stableHash(JSON.stringify({
    graph: graph.topologySignature,
    metrics,
    continuity,
    recovery: recovery.checkpointId,
  }));

  return {
    id: `compression_meta_${checksum}`,
    phase: 'PHASE_6',
    method: 'deterministic-topology-manifold',
    transform: 'semantic-graph-to-cocoon',
    checksum,
    metrics,
    continuity,
    recoveryCheckpoint: recovery.checkpointId,
    rollbackTarget: recovery.rollbackTarget,
  };
}

export function calculateEntropy(values: number[]): number {
  const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0);
  if (total === 0 || values.length <= 1) return 0;

  const entropy = values.reduce((sum, value) => {
    const probability = Math.max(value, 0) / total;
    return probability > 0 ? sum - probability * Math.log2(probability) : sum;
  }, 0);

  return round(entropy / Math.log2(values.length));
}

function anchorScore(graph: SemanticGraphAbstraction, anchor: SemanticAnchor): number {
  const supportingNodes = graph.nodes.filter(node => node.anchors.includes(anchor));
  if (supportingNodes.length === 0) return 0;

  const avgWeight = supportingNodes.reduce((sum, node) => sum + node.weight, 0) / supportingNodes.length;
  const priorityBonus = supportingNodes.some(node => node.priority <= 2) ? 0.08 : 0.04;
  const topologyBonus = graph.edges.some(edge => edge.anchors.includes(anchor)) ? 0.14 : 0.08;
  return round(Math.min(1, avgWeight * 0.84 + priorityBonus + topologyBonus));
}
