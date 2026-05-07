import { deterministicManifoldEncoder } from './manifoldEncoder';
import {
  CocoonState,
  ReinforcementLineageSummary,
  SemanticGraphAbstraction,
} from './types';
import {
  calculateCompressionMetrics,
  calculateContinuityScore,
  createMetadataRecord,
  createRecoveryManifest,
} from './metadata';
import { buildSemanticGraph, stableHash } from './semanticGraph';

export function createCocoonState(seed = 'agros-phase-6-cocoon'): CocoonState {
  const graph = buildSemanticGraph(seed);
  const encoding = deterministicManifoldEncoder.encode(graph);
  const metrics = calculateCompressionMetrics(graph, serializedUnitCount(graph));
  const continuity = calculateContinuityScore(graph);
  const recovery = createRecoveryManifest(graph);
  const metadata = createMetadataRecord(graph, metrics, continuity, recovery);
  const reinforcementLineage = createReinforcementLineage();
  const identityState = {
    anchors: graph.nodes
      .filter(node => node.priority <= 2)
      .map(node => node.id)
      .sort(),
    semanticChecksum: graph.topologySignature,
    continuityChecksum: stableHash(JSON.stringify(continuity)),
  };

  const unsigned = {
    id: `cocoon_${stableHash(`${seed}:${graph.topologySignature}`)}`,
    version: 6,
    seed,
    graph: {
      id: graph.id,
      topologySignature: graph.topologySignature,
      anchorCoverage: graph.anchorCoverage,
    },
    encoding,
    identityState,
    reinforcementLineage,
    metadata,
    recovery,
  };

  return {
    ...unsigned,
    checksum: stableHash(serializeCanonical(unsigned)),
  };
}

export function serializeCocoonState(cocoon: CocoonState): string {
  return serializeCanonical(cocoon);
}

export function deserializeCocoonState(serialized: string): CocoonState {
  return JSON.parse(serialized) as CocoonState;
}

export function getCocoonArchitectureMap(cocoon = createCocoonState()): string[] {
  return [
    'semantic units -> semantic graph abstraction',
    `semantic graph abstraction -> ${cocoon.encoding.encoder}`,
    'manifold encoding -> cocoon state serializer',
    'cocoon state serializer -> reconstruction verifier',
    'compression metadata registry -> recovery manifest',
    'reinforcement lineage -> deterministic identity state',
  ];
}

function createReinforcementLineage(): ReinforcementLineageSummary {
  return {
    source: 'PHASE_5_REINFORCEMENT_REPLAY',
    checksum: '2cce2efc3',
    decisionCount: 3,
    inheritedAxes: {
      demand: 0.58,
      engagement: 0.58,
      novelty: 0.67,
      retention: 0.8,
      diversity: 0.66,
      stability: 0.73,
    },
  };
}

function serializedUnitCount(graph: SemanticGraphAbstraction): number {
  const anchorCount = Object.values(graph.anchorCoverage).filter(value => value > 0).length;
  const topologyUnits = 4;
  return anchorCount + topologyUnits;
}

function serializeCanonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortKeys(entry)]),
    );
  }
  return value;
}
