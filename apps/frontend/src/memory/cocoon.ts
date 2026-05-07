/**
 * Cocoon Context Protocol Implementation
 * 
 * Full implementation of the STRUTHIO-SEC Cocoon Context Protocol.
 * This file defines the canonical types and collapse rules as specified
 * in the cacc00n.xml protocol document.
 * 
 * CORE PRINCIPLE: The Cocoon is NOT a memory database.
 * The Cocoon is a semantic manifold reconstruction system.
 */

import { memoryGraph, GraphNode } from './graph';
import { semanticManifold, ManifoldPoint } from './manifold';
import { lineageTracker } from './lineage';
import { compressionEngine, CocoonState } from '../compression/engine';

// ============================================================================
// Layer 1: SeedContext - Immutable root identity anchor
// ============================================================================

export interface SeedContext {
  rootSeed: string;
  creationIntent: string;
  architecturalGoals: string[];
  deterministicRules: string[];
  continuityConstraints: string[];
  identityDirectives: string[];
}

// ============================================================================
// Layer 2: EmotionalTrajectory - Computational emotional topology
// ============================================================================

export interface EmotionalVector {
  curiosity: number;      // Drive to explore new semantic regions
  uncertainty: number;    // Confidence inverse in current state
  coherence: number;      // Internal consistency of semantic graph
  reinforcementSignal: number; // Current reward/penalty signal
  novelty: number;        // Deviation from established patterns
  stability: number;      // Resistance to perturbation
}

// ============================================================================
// Layer 3: SemanticGeometry - Relationship topology (already implemented)
// ============================================================================

export interface GeometryNode {
  id: string;
  vector: number[];
  connectedTo: string[];
  semanticWeight: number;
  continuityWeight: number;
}

export interface GeometryGraph {
  nodes: GeometryNode[];
  edges: GeometryEdge[];
}

export interface GeometryEdge {
  from: string;
  to: string;
  relationType: string;
  weight: number;
}

// ============================================================================
// Layer 4: EvolutionaryMutationHistory (already implemented in lineage.ts)
// ============================================================================

export interface MutationHistory {
  mutationId: string;
  sourceState: string;
  resultingState: string;
  reinforcementScore: number;
  stabilityScore: number;
  mutationReason: string;
  accepted: boolean;
}

// ============================================================================
// Layer 5: CompressionMetadata
// ============================================================================

export interface CompressionMetadata {
  compressionMethod: 'quantization' | 'topology-preserving' | 'lossy' | 'semantic-merge';
  entropyBefore: number;
  entropyAfter: number;
  reconstructionAccuracy: number;
  manifoldDepth: number;
  semanticLossScore: number;
}

// ============================================================================
// Layer 6: PriorityHierarchy
// ============================================================================

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low' | 'disposable';

export interface PriorityClassification {
  nodeId: string;
  level: PriorityLevel;
  reason: string;
  survivalScore: number;
}

export const PRIORITY_RULES: Record<PriorityLevel, string[]> = {
  critical: [
    'deterministic rules',
    'identity directives',
    'architecture goals',
    'seed context',
  ],
  high: [
    'successful mutations',
    'reinforcement pathways',
    'stable topology',
    'emotional anchors',
  ],
  medium: [
    'intermediate reasoning',
    'temporary evolution states',
    'exploration branches',
  ],
  low: [
    'transient details',
    'duplicate structures',
    'failed mutations',
  ],
  disposable: [
    'redundant states',
    'low reinforcement noise',
    'orphaned nodes',
  ],
};

// ============================================================================
// Layer 7: RecoveryManifest
// ============================================================================

export interface RecoveryManifest {
  rebuildOrder: string[];
  criticalDependencies: string[];
  lostNodes: string[];
  reconstructionHints: string[];
  lastStableEpoch: number;
}

// ============================================================================
// Layer 8: DifferentialCurvature
// ============================================================================

export interface DifferentialState {
  velocity: number;       // f'(x) - directional evolution
  curvature: number;      // f''(x) - curvature / spread behavior
  oscillation: number;    // f'''(x) - instability oscillation
  driftRisk: number;      // Computed risk of semantic drift
}

// ============================================================================
// Layer 9: ReinforcementPersistence
// ============================================================================

export interface ReinforcementMemory {
  nodeId: string;
  rewardScore: number;
  epochSurvivalCount: number;
  reinforcementStrength: number;
  continuityScore: number;
}

// ============================================================================
// Layer 10: CollapseRules
// ============================================================================

export type CollapseCondition = 
  | 'entropyOverflow'
  | 'driftDetected'
  | 'tokenPressure'
  | 'redundancyThreshold'
  | 'instabilitySpike'
  | 'reconstructionFailure';

export type CollapseAction =
  | 'compress'
  | 'stabilize'
  | 'manifoldEncode'
  | 'merge'
  | 'rollback'
  | 'revertPreviousStableCocoon';

export interface CollapseRule {
  condition: CollapseCondition;
  action: CollapseAction;
  threshold: number;
  priority: number;
}

export const DEFAULT_COLLAPSE_RULES: CollapseRule[] = [
  { condition: 'entropyOverflow', action: 'compress', threshold: 0.9, priority: 1 },
  { condition: 'driftDetected', action: 'stabilize', threshold: 0.3, priority: 2 },
  { condition: 'tokenPressure', action: 'manifoldEncode', threshold: 0.8, priority: 3 },
  { condition: 'redundancyThreshold', action: 'merge', threshold: 0.7, priority: 4 },
  { condition: 'instabilitySpike', action: 'rollback', threshold: 0.5, priority: 5 },
  { condition: 'reconstructionFailure', action: 'revertPreviousStableCocoon', threshold: 0.6, priority: 6 },
];

// ============================================================================
// Full Cocoon State (extended from compression engine)
// ============================================================================

export interface FullCocoonState extends CocoonState {
  seedContext: SeedContext;
  emotionalTrajectory: EmotionalVector;
  compressionMetadata: CompressionMetadata;
  recoveryManifest: RecoveryManifest;
  differentialState: DifferentialState;
  priorityClassifications: PriorityClassification[];
  reinforcementMemories: ReinforcementMemory[];
  mutationHistories: MutationHistory[];
}

// ============================================================================
// Cocoon Manager - Orchestrates the full protocol
// ============================================================================

class CocoonManager {
  private seedContext: SeedContext | null = null;
  private emotionalState: EmotionalVector = {
    curiosity: 0.5,
    uncertainty: 0.3,
    coherence: 0.8,
    reinforcementSignal: 0,
    novelty: 0.2,
    stability: 0.9,
  };
  private differentialHistory: DifferentialState[] = [];
  private reinforcementMemories: Map<string, ReinforcementMemory> = new Map();
  private collapseRules: CollapseRule[] = DEFAULT_COLLAPSE_RULES;
  private stableCocoons: FullCocoonState[] = [];

  // Initialize with seed context
  initialize(seedContext: SeedContext): void {
    this.seedContext = seedContext;
    console.log('[Cocoon] Initialized with seed:', seedContext.rootSeed);
  }

  getSeedContext(): SeedContext | null {
    return this.seedContext;
  }

  // Emotional trajectory management
  updateEmotionalState(updates: Partial<EmotionalVector>): EmotionalVector {
    this.emotionalState = { ...this.emotionalState, ...updates };
    return this.emotionalState;
  }

  getEmotionalState(): EmotionalVector {
    return { ...this.emotionalState };
  }

  // Compute differential state from recent history
  computeDifferentialState(): DifferentialState {
    const recentNodes = memoryGraph.getAllNodes()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100);

    // Compute velocity (rate of change)
    const timestamps = recentNodes.map(n => n.timestamp);
    const weights = recentNodes.map(n => n.weight);
    
    const velocity = timestamps.length > 1
      ? (weights[0] - weights[weights.length - 1]) / (timestamps[0] - timestamps[timestamps.length - 1] + 1)
      : 0;

    // Compute curvature (change in velocity)
    const prevState = this.differentialHistory[this.differentialHistory.length - 1];
    const curvature = prevState ? velocity - prevState.velocity : 0;

    // Compute oscillation (change in curvature)
    const prevPrevState = this.differentialHistory[this.differentialHistory.length - 2];
    const oscillation = prevPrevState ? Math.abs(curvature - prevPrevState.curvature) : 0;

    // Compute drift risk
    const driftRisk = Math.min(1, Math.abs(oscillation) + Math.abs(curvature) * 0.5);

    const state: DifferentialState = {
      velocity,
      curvature,
      oscillation,
      driftRisk,
    };

    this.differentialHistory.push(state);
    if (this.differentialHistory.length > 100) {
      this.differentialHistory.shift();
    }

    return state;
  }

  // Priority classification
  classifyPriority(node: GraphNode): PriorityClassification {
    let level: PriorityLevel = 'medium';
    let reason = 'default classification';
    let survivalScore = 0.5;

    // Critical: High weight + many activations + old
    if (node.weight > 5 && node.activations > 10) {
      level = 'critical';
      reason = 'high weight and activation count';
      survivalScore = 1.0;
    }
    // High: Good weight or strong connections
    else if (node.weight > 2 || node.children.length > 3) {
      level = 'high';
      reason = 'significant weight or connectivity';
      survivalScore = 0.8;
    }
    // Low: Weak and isolated
    else if (node.weight < 0.5 && node.children.length === 0) {
      level = 'low';
      reason = 'weak and isolated';
      survivalScore = 0.2;
    }
    // Disposable: Very weak
    else if (node.weight < 0.2) {
      level = 'disposable';
      reason = 'negligible weight';
      survivalScore = 0.05;
    }

    return {
      nodeId: node.id,
      level,
      reason,
      survivalScore,
    };
  }

  // Reinforcement memory tracking
  trackReinforcement(nodeId: string, reward: number): void {
    const existing = this.reinforcementMemories.get(nodeId);
    const epoch = lineageTracker.getCurrentEpoch();

    if (existing) {
      existing.rewardScore += reward;
      existing.epochSurvivalCount = epoch - (existing.epochSurvivalCount || 0);
      existing.reinforcementStrength = Math.min(1, existing.reinforcementStrength + 0.1);
    } else {
      this.reinforcementMemories.set(nodeId, {
        nodeId,
        rewardScore: reward,
        epochSurvivalCount: 1,
        reinforcementStrength: 0.5,
        continuityScore: 1.0,
      });
    }
  }

  // Collapse rule evaluation
  evaluateCollapseRules(): { triggered: CollapseRule | null; metrics: Record<CollapseCondition, number> } {
    const metrics: Record<CollapseCondition, number> = {
      entropyOverflow: this.computeEntropy(),
      driftDetected: this.computeDifferentialState().driftRisk,
      tokenPressure: this.computeTokenPressure(),
      redundancyThreshold: this.computeRedundancy(),
      instabilitySpike: this.computeInstability(),
      reconstructionFailure: 0, // Set by reconstruction tests
    };

    let triggered: CollapseRule | null = null;

    for (const rule of this.collapseRules.sort((a, b) => a.priority - b.priority)) {
      if (metrics[rule.condition] >= rule.threshold) {
        triggered = rule;
        break;
      }
    }

    return { triggered, metrics };
  }

  private computeEntropy(): number {
    const nodes = memoryGraph.getAllNodes();
    if (nodes.length === 0) return 0;

    // Approximate entropy from weight distribution
    const totalWeight = nodes.reduce((sum, n) => sum + n.weight, 0);
    if (totalWeight === 0) return 0;

    let entropy = 0;
    for (const node of nodes) {
      const p = node.weight / totalWeight;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    // Normalize to 0-1
    return Math.min(1, entropy / Math.log2(nodes.length));
  }

  private computeTokenPressure(): number {
    const nodes = memoryGraph.getAllNodes();
    const contentSize = nodes.reduce((sum, n) => sum + (n.content?.length || 0), 0);
    const maxSize = 100000; // Arbitrary threshold
    return Math.min(1, contentSize / maxSize);
  }

  private computeRedundancy(): number {
    const nodes = memoryGraph.getAllNodes();
    if (nodes.length < 2) return 0;

    // Simple redundancy: count similar content
    const contentHashes = new Map<string, number>();
    for (const node of nodes) {
      const hash = this.simpleHash(node.content || '');
      contentHashes.set(hash, (contentHashes.get(hash) || 0) + 1);
    }

    const duplicates = Array.from(contentHashes.values()).filter(c => c > 1).length;
    return duplicates / nodes.length;
  }

  private computeInstability(): number {
    const diffState = this.differentialHistory[this.differentialHistory.length - 1];
    return diffState ? Math.min(1, diffState.oscillation * 10) : 0;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  // Execute collapse action
  async executeCollapseAction(rule: CollapseRule): Promise<void> {
    console.log(`[Cocoon] Executing collapse action: ${rule.action} for condition: ${rule.condition}`);

    switch (rule.action) {
      case 'compress':
        await compressionEngine.compress();
        break;
      case 'stabilize':
        this.stabilize();
        break;
      case 'manifoldEncode':
        await this.manifoldEncode();
        break;
      case 'merge':
        this.mergeRedundant();
        break;
      case 'rollback':
        await this.rollback();
        break;
      case 'revertPreviousStableCocoon':
        await this.revertToStableCocoon();
        break;
    }
  }

  private stabilize(): void {
    // Increase weight of stable nodes, decay unstable
    const nodes = memoryGraph.getAllNodes();
    for (const node of nodes) {
      const classification = this.classifyPriority(node);
      if (classification.level === 'critical' || classification.level === 'high') {
        memoryGraph.updateNode(node.id, { weight: node.weight * 1.1 });
      } else if (classification.level === 'low' || classification.level === 'disposable') {
        memoryGraph.updateNode(node.id, { weight: node.weight * 0.9 });
      }
    }
  }

  private async manifoldEncode(): Promise<void> {
    // Project graph to manifold representation
    const nodes = memoryGraph.getAllNodes();
    for (const node of nodes) {
      if (!semanticManifold.getPoint(node.id)) {
        const embedding = node.embedding || this.generateEmbedding(node);
        semanticManifold.addPoint({
          id: node.id,
          embedding,
          semanticLabel: node.type,
        });
      }
    }
    semanticManifold.updateNeighbors(5);
  }

  private generateEmbedding(node: GraphNode): number[] {
    const hash = this.simpleHash(node.id + (node.content || ''));
    return Array.from({ length: 128 }, (_, i) => 
      Math.sin(parseInt(hash, 16) * (i + 1)) * Math.cos(parseInt(hash, 16) * (i + 2))
    );
  }

  private mergeRedundant(): void {
    const nodes = memoryGraph.getAllNodes();
    const contentHashes = new Map<string, GraphNode[]>();

    for (const node of nodes) {
      const hash = this.simpleHash(node.content || '');
      const existing = contentHashes.get(hash) || [];
      existing.push(node);
      contentHashes.set(hash, existing);
    }

    for (const [, duplicates] of contentHashes) {
      if (duplicates.length > 1) {
        // Keep the one with highest weight, remove others
        const sorted = duplicates.sort((a, b) => b.weight - a.weight);
        for (let i = 1; i < sorted.length; i++) {
          memoryGraph.removeNode(sorted[i].id);
        }
      }
    }
  }

  private async rollback(): Promise<void> {
    // Find last stable differential state
    const stableIdx = this.differentialHistory.findIndex(s => s.driftRisk < 0.2);
    if (stableIdx > 0) {
      this.differentialHistory = this.differentialHistory.slice(0, stableIdx + 1);
    }
  }

  private async revertToStableCocoon(): Promise<void> {
    const lastStable = this.stableCocoons[this.stableCocoons.length - 1];
    if (lastStable) {
      await compressionEngine.reconstruct(lastStable);
    }
  }

  // Generate full cocoon state
  async generateFullCocoon(): Promise<FullCocoonState> {
    const baseCocoon = await compressionEngine.compress();
    
    // Classify all nodes
    const nodes = memoryGraph.getAllNodes();
    const priorityClassifications = nodes.map(n => this.classifyPriority(n));

    // Build recovery manifest
    const criticalNodes = priorityClassifications
      .filter(p => p.level === 'critical')
      .map(p => p.nodeId);
    
    const recoveryManifest: RecoveryManifest = {
      rebuildOrder: criticalNodes,
      criticalDependencies: criticalNodes.slice(0, 10),
      lostNodes: [],
      reconstructionHints: [
        'Restore critical nodes first',
        'Rebuild edges from lineage',
        'Verify topology hash',
      ],
      lastStableEpoch: lineageTracker.getCurrentEpoch(),
    };

    // Compute compression metadata
    const compressionMetadata: CompressionMetadata = {
      compressionMethod: 'topology-preserving',
      entropyBefore: this.computeEntropy(),
      entropyAfter: this.computeEntropy() * baseCocoon.compressionLevel,
      reconstructionAccuracy: 0.95,
      manifoldDepth: semanticManifold.getMetrics().regionCount,
      semanticLossScore: 1 - baseCocoon.compressionLevel,
    };

    const fullCocoon: FullCocoonState = {
      ...baseCocoon,
      seedContext: this.seedContext!,
      emotionalTrajectory: this.emotionalState,
      compressionMetadata,
      recoveryManifest,
      differentialState: this.computeDifferentialState(),
      priorityClassifications,
      reinforcementMemories: Array.from(this.reinforcementMemories.values()),
      mutationHistories: [],
    };

    this.stableCocoons.push(fullCocoon);
    return fullCocoon;
  }

  // Reconstruct from full cocoon
  async reconstructFromCocoon(cocoon: FullCocoonState): Promise<boolean> {
    // Restore seed context
    if (cocoon.seedContext) {
      this.seedContext = cocoon.seedContext;
    }

    // Restore emotional state
    this.emotionalState = cocoon.emotionalTrajectory;

    // Restore reinforcement memories
    for (const memory of cocoon.reinforcementMemories) {
      this.reinforcementMemories.set(memory.nodeId, memory);
    }

    // Reconstruct base state
    const result = await compressionEngine.reconstruct(cocoon);
    
    return result.success && result.fidelity > 0.8;
  }
}

export const cocoonManager = new CocoonManager();
