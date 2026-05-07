import {
  SemanticAnchor,
  SemanticGraphAbstraction,
  SemanticGraphEdge,
  SemanticGraphNode,
  SemanticUnit,
} from './types';

const FEATURE_DIMENSIONS: SemanticAnchor[] = [
  'determinism',
  'emotional-continuity',
  'reasoning-continuity',
  'architectural-intent',
  'semantic-topology',
  'reinforcement-lineage',
  'recovery',
];

const PHASE6_SEMANTIC_UNITS: SemanticUnit[] = [
  {
    id: 'seed-determinism',
    label: 'Deterministic replay identity',
    kind: 'identity',
    weight: 1,
    priority: 1,
    anchors: ['determinism', 'architectural-intent'],
    inheritsFrom: [],
    summary: 'Seeded replay and checksum identity survive compression.',
  },
  {
    id: 'emotional-continuity',
    label: 'Emotional continuity vector',
    kind: 'emotion',
    weight: 0.92,
    priority: 2,
    anchors: ['emotional-continuity', 'semantic-topology'],
    inheritsFrom: ['seed-determinism'],
    summary: 'Emotional continuity is reduced to stable weighted anchors.',
  },
  {
    id: 'reasoning-continuity',
    label: 'Reasoning continuity path',
    kind: 'reasoning',
    weight: 0.95,
    priority: 2,
    anchors: ['reasoning-continuity', 'architectural-intent'],
    inheritsFrom: ['seed-determinism'],
    summary: 'Reasoning is preserved as ordered reconstructable intent steps.',
  },
  {
    id: 'semantic-topology',
    label: 'Semantic topology graph',
    kind: 'architecture',
    weight: 0.98,
    priority: 1,
    anchors: ['semantic-topology', 'architectural-intent', 'recovery'],
    inheritsFrom: ['reasoning-continuity'],
    summary: 'Topology is preserved through explicit nodes, edges, and coverage metrics.',
  },
  {
    id: 'reinforcement-lineage',
    label: 'Reinforcement lineage inheritance',
    kind: 'reinforcement',
    weight: 0.9,
    priority: 3,
    anchors: ['reinforcement-lineage', 'determinism'],
    inheritsFrom: ['semantic-topology'],
    summary: 'Phase 5 reward lineage is inherited as deterministic scoring metadata.',
  },
  {
    id: 'compression-boundary',
    label: 'Entropy-aware compression boundary',
    kind: 'architecture',
    weight: 0.88,
    priority: 3,
    anchors: ['semantic-topology', 'recovery'],
    inheritsFrom: ['semantic-topology', 'reinforcement-lineage'],
    summary: 'Compression limits are explicit and entropy accounted.',
  },
  {
    id: 'rollback-recovery',
    label: 'Rollback recovery checkpoint',
    kind: 'recovery',
    weight: 0.84,
    priority: 4,
    anchors: ['recovery', 'determinism', 'reasoning-continuity'],
    inheritsFrom: ['compression-boundary'],
    summary: 'Recovery rebuild order is derived from priority and topology.',
  },
];

export function buildSemanticGraph(seed = 'agros-phase-6-cocoon'): SemanticGraphAbstraction {
  const nodes = PHASE6_SEMANTIC_UNITS.map(unit => createNode(unit));
  const edges = createEdges(PHASE6_SEMANTIC_UNITS);
  const topologySignature = stableHash(JSON.stringify({
    seed,
    nodes: nodes.map(node => [node.id, node.signature, node.anchors]),
    edges: edges.map(edge => [edge.source, edge.target, edge.relation, edge.weight]),
  }));

  return {
    id: `semantic_graph_${stableHash(seed)}`,
    seed,
    nodes,
    edges,
    topologySignature,
    anchorCoverage: calculateAnchorCoverage(nodes),
  };
}

export function stableHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) + value.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function round(value: number): number {
  return Number(value.toFixed(4));
}

function createNode(unit: SemanticUnit): SemanticGraphNode {
  const featureVector = FEATURE_DIMENSIONS.map(anchor => {
    const anchorMass = unit.anchors.includes(anchor) ? 1 : 0;
    const inheritanceMass = unit.inheritsFrom.length > 0 ? 0.08 : 0;
    return round(anchorMass * unit.weight + inheritanceMass + (1 / unit.priority) * 0.03);
  });

  return {
    id: unit.id,
    label: unit.label,
    kind: unit.kind,
    weight: unit.weight,
    priority: unit.priority,
    anchors: [...unit.anchors].sort(),
    featureVector,
    signature: stableHash(JSON.stringify({
      id: unit.id,
      kind: unit.kind,
      anchors: [...unit.anchors].sort(),
      inheritsFrom: [...unit.inheritsFrom].sort(),
      weight: unit.weight,
      priority: unit.priority,
      summary: unit.summary,
    })),
  };
}

function createEdges(units: SemanticUnit[]): SemanticGraphEdge[] {
  const explicit = units.flatMap(unit => unit.inheritsFrom.map(parent => {
    const parentUnit = units.find(candidate => candidate.id === parent);
    const sharedAnchors = parentUnit ? intersection(unit.anchors, parentUnit.anchors) : [];
    return {
      source: parent,
      target: unit.id,
      relation: 'inherits' as const,
      weight: round(0.72 + sharedAnchors.length * 0.07 + unit.weight * 0.08),
      anchors: sharedAnchors.length ? sharedAnchors : [...unit.anchors].slice(0, 1),
    };
  }));

  const preservation = units
    .filter(unit => unit.anchors.includes('semantic-topology'))
    .map(unit => ({
      source: 'semantic-topology',
      target: unit.id,
      relation: unit.id === 'semantic-topology' ? 'stabilizes' as const : 'preserves' as const,
      weight: unit.id === 'semantic-topology' ? 1 : round(0.58 + unit.weight * 0.1),
      anchors: intersection(unit.anchors, ['semantic-topology', 'architectural-intent', 'recovery'] as SemanticAnchor[]),
    }))
    .filter(edge => edge.source !== edge.target);

  return [...explicit, ...preservation]
    .sort((a, b) => `${a.source}:${a.target}`.localeCompare(`${b.source}:${b.target}`));
}

function calculateAnchorCoverage(nodes: SemanticGraphNode[]): Record<SemanticAnchor, number> {
  const coverage = Object.fromEntries(FEATURE_DIMENSIONS.map(anchor => [anchor, 0])) as Record<SemanticAnchor, number>;
  for (const anchor of FEATURE_DIMENSIONS) {
    const total = nodes.reduce((sum, node) => sum + (node.anchors.includes(anchor) ? node.weight : 0), 0);
    coverage[anchor] = round(total / nodes.length);
  }
  return coverage;
}

function intersection<T>(left: T[], right: T[]): T[] {
  return left.filter(item => right.includes(item)).sort();
}
