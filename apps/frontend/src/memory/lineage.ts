/**
 * Memory Lineage Tracker
 * 
 * Tracks the ancestry and evolution of memory nodes over time.
 * Enables reconstruction of memory state at any point in history.
 * 
 * Key concepts:
 * - Lineage: The chain of ancestors for any memory node
 * - Derivation: How a node was created (compression, merge, split, mutation)
 * - Epoch: A point in time for memory snapshots
 * - Inheritance: Properties passed from parent to child nodes
 */

import { memoryGraph, GraphNode } from './graph';
import { CocoonState } from '../compression/engine';

export type DerivationType = 
  | 'creation'
  | 'compression' 
  | 'merge' 
  | 'split' 
  | 'mutation' 
  | 'inheritance'
  | 'reconstruction';

export interface LineageNode {
  id: string;
  memoryNodeId: string;
  parentIds: string[];
  childIds: string[];
  derivationType: DerivationType;
  epoch: number;
  timestamp: number;
  metadata: {
    compressionRatio?: number;
    mutationDelta?: number;
    mergedFrom?: string[];
    splitInto?: string[];
    reconstructionSource?: string;
  };
}

export interface LineageEdge {
  id: string;
  sourceId: string;
  targetId: string;
  derivationType: DerivationType;
  strength: number;
  timestamp: number;
}

export interface Epoch {
  id: number;
  timestamp: number;
  nodeCount: number;
  edgeCount: number;
  compressionState?: string;
  description: string;
}

export interface LineageQuery {
  nodeId?: string;
  derivationType?: DerivationType;
  epochRange?: { start: number; end: number };
  maxDepth?: number;
}

export interface AncestryPath {
  path: LineageNode[];
  depth: number;
  derivationChain: DerivationType[];
  totalMutationDelta: number;
}

export interface LineageMetrics {
  totalNodes: number;
  totalEdges: number;
  currentEpoch: number;
  avgLineageDepth: number;
  derivationDistribution: Record<DerivationType, number>;
  compressionEvents: number;
  reconstructionEvents: number;
}

class MemoryLineageTracker {
  private nodes: Map<string, LineageNode> = new Map();
  private edges: Map<string, LineageEdge> = new Map();
  private epochs: Map<number, Epoch> = new Map();
  private currentEpoch: number = 0;
  private nodeToLineage: Map<string, string> = new Map(); // memoryNodeId -> lineageNodeId

  // Epoch management
  startNewEpoch(description: string): Epoch {
    this.currentEpoch++;
    const epoch: Epoch = {
      id: this.currentEpoch,
      timestamp: Date.now(),
      nodeCount: memoryGraph.getAllNodes().length,
      edgeCount: memoryGraph.getAllEdges().length,
      description,
    };
    this.epochs.set(epoch.id, epoch);
    return epoch;
  }

  getCurrentEpoch(): number {
    return this.currentEpoch;
  }

  getEpoch(id: number): Epoch | undefined {
    return this.epochs.get(id);
  }

  getAllEpochs(): Epoch[] {
    return Array.from(this.epochs.values()).sort((a, b) => a.id - b.id);
  }

  // Track node creation
  trackCreation(memoryNodeId: string, metadata: Record<string, unknown> = {}): LineageNode {
    const lineageNode = this.createLineageNode(memoryNodeId, 'creation', [], metadata);
    return lineageNode;
  }

  // Track compression
  trackCompression(
    sourceNodeIds: string[], 
    targetNodeId: string, 
    compressionRatio: number
  ): LineageNode {
    const parentLineageIds = sourceNodeIds
      .map(id => this.nodeToLineage.get(id))
      .filter((id): id is string => id !== undefined);

    const lineageNode = this.createLineageNode(
      targetNodeId, 
      'compression', 
      parentLineageIds,
      { compressionRatio, mergedFrom: sourceNodeIds }
    );

    // Update parent children
    for (const parentId of parentLineageIds) {
      const parent = this.nodes.get(parentId);
      if (parent) {
        parent.childIds.push(lineageNode.id);
      }
    }

    // Create edges
    for (const parentId of parentLineageIds) {
      this.createLineageEdge(parentId, lineageNode.id, 'compression', compressionRatio);
    }

    return lineageNode;
  }

  // Track merge
  trackMerge(sourceNodeIds: string[], targetNodeId: string): LineageNode {
    const parentLineageIds = sourceNodeIds
      .map(id => this.nodeToLineage.get(id))
      .filter((id): id is string => id !== undefined);

    const lineageNode = this.createLineageNode(
      targetNodeId, 
      'merge', 
      parentLineageIds,
      { mergedFrom: sourceNodeIds }
    );

    for (const parentId of parentLineageIds) {
      const parent = this.nodes.get(parentId);
      if (parent) {
        parent.childIds.push(lineageNode.id);
      }
      this.createLineageEdge(parentId, lineageNode.id, 'merge', 1.0);
    }

    return lineageNode;
  }

  // Track split
  trackSplit(sourceNodeId: string, targetNodeIds: string[]): LineageNode[] {
    const parentLineageId = this.nodeToLineage.get(sourceNodeId);
    const results: LineageNode[] = [];

    for (const targetId of targetNodeIds) {
      const lineageNode = this.createLineageNode(
        targetId, 
        'split', 
        parentLineageId ? [parentLineageId] : [],
        { splitInto: targetNodeIds }
      );

      if (parentLineageId) {
        const parent = this.nodes.get(parentLineageId);
        if (parent) {
          parent.childIds.push(lineageNode.id);
        }
        this.createLineageEdge(parentLineageId, lineageNode.id, 'split', 1.0 / targetNodeIds.length);
      }

      results.push(lineageNode);
    }

    return results;
  }

  // Track mutation
  trackMutation(nodeId: string, mutationDelta: number): LineageNode {
    const existingLineageId = this.nodeToLineage.get(nodeId);
    
    const lineageNode = this.createLineageNode(
      nodeId, 
      'mutation', 
      existingLineageId ? [existingLineageId] : [],
      { mutationDelta }
    );

    if (existingLineageId) {
      const parent = this.nodes.get(existingLineageId);
      if (parent) {
        parent.childIds.push(lineageNode.id);
      }
      this.createLineageEdge(existingLineageId, lineageNode.id, 'mutation', 1 - mutationDelta);
    }

    return lineageNode;
  }

  // Track reconstruction from cocoon
  trackReconstruction(cocoon: CocoonState, restoredNodeIds: string[]): LineageNode[] {
    const results: LineageNode[] = [];

    for (const nodeId of restoredNodeIds) {
      const lineageNode = this.createLineageNode(
        nodeId, 
        'reconstruction', 
        [],
        { reconstructionSource: cocoon.id }
      );
      results.push(lineageNode);
    }

    return results;
  }

  // Track inheritance
  trackInheritance(parentNodeId: string, childNodeId: string): LineageNode {
    const parentLineageId = this.nodeToLineage.get(parentNodeId);
    
    const lineageNode = this.createLineageNode(
      childNodeId, 
      'inheritance', 
      parentLineageId ? [parentLineageId] : []
    );

    if (parentLineageId) {
      const parent = this.nodes.get(parentLineageId);
      if (parent) {
        parent.childIds.push(lineageNode.id);
      }
      this.createLineageEdge(parentLineageId, lineageNode.id, 'inheritance', 1.0);
    }

    return lineageNode;
  }

  // Query lineage
  getLineageNode(id: string): LineageNode | undefined {
    return this.nodes.get(id);
  }

  getLineageForMemoryNode(memoryNodeId: string): LineageNode | undefined {
    const lineageId = this.nodeToLineage.get(memoryNodeId);
    return lineageId ? this.nodes.get(lineageId) : undefined;
  }

  // Get ancestry (all ancestors up the tree)
  getAncestry(nodeId: string, maxDepth = 10): AncestryPath {
    const lineageId = this.nodeToLineage.get(nodeId) || nodeId;
    const path: LineageNode[] = [];
    const derivationChain: DerivationType[] = [];
    let totalMutationDelta = 0;
    let currentIds = [lineageId];
    let depth = 0;

    while (currentIds.length > 0 && depth < maxDepth) {
      const nextIds: string[] = [];
      
      for (const id of currentIds) {
        const node = this.nodes.get(id);
        if (node) {
          path.push(node);
          derivationChain.push(node.derivationType);
          totalMutationDelta += node.metadata.mutationDelta || 0;
          nextIds.push(...node.parentIds);
        }
      }

      currentIds = nextIds;
      depth++;
    }

    return {
      path,
      depth: path.length,
      derivationChain,
      totalMutationDelta,
    };
  }

  // Get descendants (all children down the tree)
  getDescendants(nodeId: string, maxDepth = 10): LineageNode[] {
    const lineageId = this.nodeToLineage.get(nodeId) || nodeId;
    const descendants: LineageNode[] = [];
    let currentIds = [lineageId];
    let depth = 0;

    while (currentIds.length > 0 && depth < maxDepth) {
      const nextIds: string[] = [];
      
      for (const id of currentIds) {
        const node = this.nodes.get(id);
        if (node) {
          for (const childId of node.childIds) {
            const child = this.nodes.get(childId);
            if (child) {
              descendants.push(child);
              nextIds.push(childId);
            }
          }
        }
      }

      currentIds = nextIds;
      depth++;
    }

    return descendants;
  }

  // Query by criteria
  query(criteria: LineageQuery): LineageNode[] {
    let results = Array.from(this.nodes.values());

    if (criteria.nodeId) {
      results = results.filter(n => n.memoryNodeId === criteria.nodeId);
    }

    if (criteria.derivationType) {
      results = results.filter(n => n.derivationType === criteria.derivationType);
    }

    if (criteria.epochRange) {
      results = results.filter(n => 
        n.epoch >= criteria.epochRange!.start && 
        n.epoch <= criteria.epochRange!.end
      );
    }

    return results;
  }

  // Find common ancestor
  findCommonAncestor(nodeIdA: string, nodeIdB: string): LineageNode | null {
    const ancestryA = new Set(this.getAncestry(nodeIdA).path.map(n => n.id));
    const ancestryB = this.getAncestry(nodeIdB).path;

    for (const node of ancestryB) {
      if (ancestryA.has(node.id)) {
        return node;
      }
    }

    return null;
  }

  // Compute divergence between two nodes
  computeDivergence(nodeIdA: string, nodeIdB: string): {
    commonAncestor: LineageNode | null;
    pathA: LineageNode[];
    pathB: LineageNode[];
    divergenceEpoch: number | null;
  } {
    const commonAncestor = this.findCommonAncestor(nodeIdA, nodeIdB);
    const ancestryA = this.getAncestry(nodeIdA).path;
    const ancestryB = this.getAncestry(nodeIdB).path;

    const pathA: LineageNode[] = [];
    const pathB: LineageNode[] = [];

    // Get paths from each node to common ancestor
    for (const node of ancestryA) {
      pathA.push(node);
      if (commonAncestor && node.id === commonAncestor.id) break;
    }

    for (const node of ancestryB) {
      pathB.push(node);
      if (commonAncestor && node.id === commonAncestor.id) break;
    }

    return {
      commonAncestor,
      pathA,
      pathB,
      divergenceEpoch: commonAncestor?.epoch || null,
    };
  }

  // Get lineage graph for visualization
  getLineageGraph(): { nodes: LineageNode[]; edges: LineageEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  // Get nodes at specific epoch
  getNodesAtEpoch(epochId: number): LineageNode[] {
    return Array.from(this.nodes.values()).filter(n => n.epoch === epochId);
  }

  // Metrics
  getMetrics(): LineageMetrics {
    const nodes = Array.from(this.nodes.values());
    
    // Compute derivation distribution
    const derivationDistribution: Record<DerivationType, number> = {
      creation: 0,
      compression: 0,
      merge: 0,
      split: 0,
      mutation: 0,
      inheritance: 0,
      reconstruction: 0,
    };

    for (const node of nodes) {
      derivationDistribution[node.derivationType]++;
    }

    // Compute average lineage depth
    let totalDepth = 0;
    for (const node of nodes) {
      const ancestry = this.getAncestry(node.id, 100);
      totalDepth += ancestry.depth;
    }
    const avgLineageDepth = nodes.length > 0 ? totalDepth / nodes.length : 0;

    return {
      totalNodes: nodes.length,
      totalEdges: this.edges.size,
      currentEpoch: this.currentEpoch,
      avgLineageDepth,
      derivationDistribution,
      compressionEvents: derivationDistribution.compression,
      reconstructionEvents: derivationDistribution.reconstruction,
    };
  }

  // Export for persistence
  exportState(): {
    nodes: LineageNode[];
    edges: LineageEdge[];
    epochs: Epoch[];
    currentEpoch: number;
    nodeToLineage: [string, string][];
  } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      epochs: Array.from(this.epochs.values()),
      currentEpoch: this.currentEpoch,
      nodeToLineage: Array.from(this.nodeToLineage.entries()),
    };
  }

  // Import from persistence
  importState(state: ReturnType<typeof this.exportState>): void {
    this.clear();
    
    for (const node of state.nodes) {
      this.nodes.set(node.id, node);
    }
    for (const edge of state.edges) {
      this.edges.set(edge.id, edge);
    }
    for (const epoch of state.epochs) {
      this.epochs.set(epoch.id, epoch);
    }
    for (const [memoryId, lineageId] of state.nodeToLineage) {
      this.nodeToLineage.set(memoryId, lineageId);
    }
    this.currentEpoch = state.currentEpoch;
  }

  // Helper methods
  private createLineageNode(
    memoryNodeId: string,
    derivationType: DerivationType,
    parentIds: string[],
    metadata: LineageNode['metadata'] = {}
  ): LineageNode {
    const id = `lineage_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    const node: LineageNode = {
      id,
      memoryNodeId,
      parentIds,
      childIds: [],
      derivationType,
      epoch: this.currentEpoch,
      timestamp: Date.now(),
      metadata,
    };

    this.nodes.set(id, node);
    this.nodeToLineage.set(memoryNodeId, id);
    
    return node;
  }

  private createLineageEdge(
    sourceId: string,
    targetId: string,
    derivationType: DerivationType,
    strength: number
  ): LineageEdge {
    const id = `edge_${sourceId}_${targetId}`;
    
    const edge: LineageEdge = {
      id,
      sourceId,
      targetId,
      derivationType,
      strength,
      timestamp: Date.now(),
    };

    this.edges.set(id, edge);
    return edge;
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.epochs.clear();
    this.nodeToLineage.clear();
    this.currentEpoch = 0;
  }
}

export const lineageTracker = new MemoryLineageTracker();
