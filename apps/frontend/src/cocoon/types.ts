export type SemanticAnchor =
  | 'determinism'
  | 'emotional-continuity'
  | 'reasoning-continuity'
  | 'architectural-intent'
  | 'semantic-topology'
  | 'reinforcement-lineage'
  | 'recovery';

export type SemanticUnitKind =
  | 'identity'
  | 'architecture'
  | 'reasoning'
  | 'emotion'
  | 'reinforcement'
  | 'recovery';

export interface SemanticUnit {
  id: string;
  label: string;
  kind: SemanticUnitKind;
  weight: number;
  priority: number;
  anchors: SemanticAnchor[];
  inheritsFrom: string[];
  summary: string;
}

export interface SemanticGraphNode {
  id: string;
  label: string;
  kind: SemanticUnitKind;
  weight: number;
  priority: number;
  anchors: SemanticAnchor[];
  featureVector: number[];
  signature: string;
}

export interface SemanticGraphEdge {
  source: string;
  target: string;
  relation: 'inherits' | 'preserves' | 'stabilizes' | 'compresses';
  weight: number;
  anchors: SemanticAnchor[];
}

export interface SemanticGraphAbstraction {
  id: string;
  seed: string;
  nodes: SemanticGraphNode[];
  edges: SemanticGraphEdge[];
  topologySignature: string;
  anchorCoverage: Record<SemanticAnchor, number>;
}

export interface ManifoldEncoder {
  name: string;
  version: number;
  encode(graph: SemanticGraphAbstraction): ManifoldEncoding;
}

export interface ManifoldEncoding {
  encoder: string;
  dimensions: string[];
  nodes: Array<{
    id: string;
    coordinates: number[];
    radius: number;
    anchorMass: number;
  }>;
  geodesics: Array<{
    source: string;
    target: string;
    distance: number;
    curvature: number;
    relation: SemanticGraphEdge['relation'];
  }>;
  topology: {
    nodeCount: number;
    edgeCount: number;
    connectedComponents: number;
    averageDegree: number;
    anchorSignature: string;
    checksum: string;
  };
}

export interface ReinforcementLineageSummary {
  source: string;
  checksum: string;
  decisionCount: number;
  inheritedAxes: Record<'demand' | 'engagement' | 'novelty' | 'retention' | 'diversity' | 'stability', number>;
}

export interface CompressionMetrics {
  originalUnits: number;
  serializedUnits: number;
  compressionRatio: number;
  entropyBefore: number;
  entropyAfter: number;
  entropyDelta: number;
  semanticLoss: number;
  topologyPreservation: number;
}

export interface ContinuityScore {
  emotional: number;
  reasoning: number;
  identity: number;
  architecture: number;
  reinforcement: number;
  overall: number;
}

export interface CompressionMetadataRecord {
  id: string;
  phase: 'PHASE_6';
  method: 'deterministic-topology-manifold';
  transform: 'semantic-graph-to-cocoon';
  checksum: string;
  metrics: CompressionMetrics;
  continuity: ContinuityScore;
  recoveryCheckpoint: string;
  rollbackTarget: string;
}

export interface RecoveryManifest {
  checkpointId: string;
  rollbackTarget: string;
  rebuildOrder: string[];
  requiredAnchors: SemanticAnchor[];
  validationBoundaries: string[];
  reconstructionHints: string[];
}

export interface CocoonState {
  id: string;
  version: number;
  seed: string;
  graph: Pick<SemanticGraphAbstraction, 'id' | 'topologySignature' | 'anchorCoverage'>;
  encoding: ManifoldEncoding;
  identityState: {
    anchors: string[];
    semanticChecksum: string;
    continuityChecksum: string;
  };
  reinforcementLineage: ReinforcementLineageSummary;
  metadata: CompressionMetadataRecord;
  recovery: RecoveryManifest;
  checksum: string;
}

export interface ReconstructionValidationReport {
  stable: boolean;
  accuracy: number;
  deterministic: boolean;
  topologyMatch: boolean;
  continuityPreserved: boolean;
  entropyAccounted: boolean;
  checksum: string;
  errors: string[];
}

export interface CocoonReplaySummary {
  stable: boolean;
  checksum: string;
  firstChecksum: string;
  secondChecksum: string;
  reconstruction: ReconstructionValidationReport;
  continuity: ContinuityScore;
  metrics: CompressionMetrics;
  topology: ManifoldEncoding['topology'];
}
