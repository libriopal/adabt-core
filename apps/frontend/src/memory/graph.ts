/**
 * Contextual Memory Graph
 * 
 * A directed graph structure for storing and navigating semantic memories.
 * Supports weighted edges, node clustering, and traversal algorithms.
 * 
 * Memory is NOT linear history - it's a topology of interconnected concepts.
 */

import { persistence, MemoryNode, MemoryEdge } from '../storage/indexedDB';

export type NodeType = 'semantic' | 'emotional' | 'procedural' | 'contextual' | 'geometric';

export interface GraphNode extends MemoryNode {
  cluster?: string;
  depth: number;
  activations: number;
  lastActivated: number;
  compressed: boolean;
  compressionRatio?: number;
  parentId?: string;
  children: string[];
  metadata: Record<string, unknown>;
}

export interface GraphEdge extends MemoryEdge {
  bidirectional: boolean;
  traversalCount: number;
  lastTraversed: number;
  decayRate: number;
}

export interface GraphTraversal {
  path: string[];
  totalStrength: number;
  depth: number;
  timestamp: number;
}

export interface ClusterInfo {
  id: string;
  centroid: string;
  members: string[];
  coherence: number;
  density: number;
}

export interface GraphMetrics {
  nodeCount: number;
  edgeCount: number;
  avgDegree: number;
  density: number;
  clusterCount: number;
  maxDepth: number;
  compressionRatio: number;
}

class ContextualMemoryGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private adjacency: Map<string, Set<string>> = new Map();
  private reverseAdjacency: Map<string, Set<string>> = new Map();
  private clusters: Map<string, ClusterInfo> = new Map();
  private sessionId: string = '';

  async init(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    await this.loadFromPersistence();
    console.log(`[MemoryGraph] Initialized with ${this.nodes.size} nodes, ${this.edges.size} edges`);
  }

  private async loadFromPersistence(): Promise<void> {
    // Load persisted memory state
    try {
      const checkpoint = await persistence.getLatestCheckpoint(this.sessionId);
      if (checkpoint?.memoryState) {
        for (const node of checkpoint.memoryState.nodes) {
          this.addNode(node as GraphNode, false);
        }
        for (const edge of checkpoint.memoryState.edges) {
          this.addEdge(edge as GraphEdge, false);
        }
      }
    } catch (e) {
      console.warn('[MemoryGraph] Failed to load from persistence:', e);
    }
  }

  // Node operations
  addNode(node: Partial<GraphNode> & { id: string }, persist = true): GraphNode {
    const fullNode: GraphNode = {
      type: 'semantic',
      content: '',
      weight: 1.0,
      timestamp: Date.now(),
      depth: 0,
      activations: 0,
      lastActivated: Date.now(),
      compressed: false,
      children: [],
      metadata: {},
      ...node,
    };

    this.nodes.set(fullNode.id, fullNode);
    
    if (!this.adjacency.has(fullNode.id)) {
      this.adjacency.set(fullNode.id, new Set());
    }
    if (!this.reverseAdjacency.has(fullNode.id)) {
      this.reverseAdjacency.set(fullNode.id, new Set());
    }

    if (persist) {
      this.persistState();
    }

    return fullNode;
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  updateNode(id: string, updates: Partial<GraphNode>): GraphNode | undefined {
    const node = this.nodes.get(id);
    if (!node) return undefined;

    const updated = { ...node, ...updates };
    this.nodes.set(id, updated);
    this.persistState();
    return updated;
  }

  removeNode(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Remove all connected edges
    const outgoing = this.adjacency.get(id) || new Set();
    const incoming = this.reverseAdjacency.get(id) || new Set();

    for (const targetId of outgoing) {
      this.removeEdge(id, targetId);
    }
    for (const sourceId of incoming) {
      this.removeEdge(sourceId, id);
    }

    // Remove from parent's children
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId);
      if (parent) {
        parent.children = parent.children.filter(c => c !== id);
      }
    }

    this.nodes.delete(id);
    this.adjacency.delete(id);
    this.reverseAdjacency.delete(id);
    this.persistState();

    return true;
  }

  activateNode(id: string): void {
    const node = this.nodes.get(id);
    if (node) {
      node.activations++;
      node.lastActivated = Date.now();
      node.weight = Math.min(node.weight * 1.1, 10); // Strengthen with cap
    }
  }

  // Edge operations
  addEdge(edge: Partial<GraphEdge> & { source: string; target: string }, persist = true): GraphEdge {
    const edgeId = `${edge.source}->${edge.target}`;
    
    const fullEdge: GraphEdge = {
      relation: 'related',
      strength: 1.0,
      bidirectional: false,
      traversalCount: 0,
      lastTraversed: Date.now(),
      decayRate: 0.01,
      ...edge,
    };

    this.edges.set(edgeId, fullEdge);
    
    // Update adjacency
    if (!this.adjacency.has(edge.source)) {
      this.adjacency.set(edge.source, new Set());
    }
    this.adjacency.get(edge.source)!.add(edge.target);

    if (!this.reverseAdjacency.has(edge.target)) {
      this.reverseAdjacency.set(edge.target, new Set());
    }
    this.reverseAdjacency.get(edge.target)!.add(edge.source);

    // Handle bidirectional edges
    if (fullEdge.bidirectional) {
      const reverseId = `${edge.target}->${edge.source}`;
      if (!this.edges.has(reverseId)) {
        this.edges.set(reverseId, {
          ...fullEdge,
          source: edge.target,
          target: edge.source,
        });
        this.adjacency.get(edge.target)?.add(edge.source);
        this.reverseAdjacency.get(edge.source)?.add(edge.target);
      }
    }

    if (persist) {
      this.persistState();
    }

    return fullEdge;
  }

  getEdge(source: string, target: string): GraphEdge | undefined {
    return this.edges.get(`${source}->${target}`);
  }

  removeEdge(source: string, target: string): boolean {
    const edgeId = `${source}->${target}`;
    const edge = this.edges.get(edgeId);
    if (!edge) return false;

    this.edges.delete(edgeId);
    this.adjacency.get(source)?.delete(target);
    this.reverseAdjacency.get(target)?.delete(source);

    if (edge.bidirectional) {
      const reverseId = `${target}->${source}`;
      this.edges.delete(reverseId);
      this.adjacency.get(target)?.delete(source);
      this.reverseAdjacency.get(source)?.delete(target);
    }

    this.persistState();
    return true;
  }

  traverseEdge(source: string, target: string): void {
    const edge = this.getEdge(source, target);
    if (edge) {
      edge.traversalCount++;
      edge.lastTraversed = Date.now();
      edge.strength = Math.min(edge.strength * 1.05, 10); // Strengthen with cap
      this.activateNode(source);
      this.activateNode(target);
    }
  }

  // Traversal algorithms
  getNeighbors(id: string, direction: 'outgoing' | 'incoming' | 'both' = 'both'): GraphNode[] {
    const neighbors: Set<string> = new Set();

    if (direction === 'outgoing' || direction === 'both') {
      const outgoing = this.adjacency.get(id);
      if (outgoing) {
        for (const n of outgoing) neighbors.add(n);
      }
    }

    if (direction === 'incoming' || direction === 'both') {
      const incoming = this.reverseAdjacency.get(id);
      if (incoming) {
        for (const n of incoming) neighbors.add(n);
      }
    }

    return Array.from(neighbors)
      .map(nid => this.nodes.get(nid))
      .filter((n): n is GraphNode => n !== undefined);
  }

  breadthFirstSearch(startId: string, maxDepth = 5): GraphTraversal[] {
    const traversals: GraphTraversal[] = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[]; depth: number; strength: number }> = [
      { id: startId, path: [startId], depth: 0, strength: 1.0 }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current.id)) continue;
      visited.add(current.id);

      traversals.push({
        path: current.path,
        totalStrength: current.strength,
        depth: current.depth,
        timestamp: Date.now(),
      });

      if (current.depth >= maxDepth) continue;

      const neighbors = this.adjacency.get(current.id) || new Set();
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          const edge = this.getEdge(current.id, neighborId);
          queue.push({
            id: neighborId,
            path: [...current.path, neighborId],
            depth: current.depth + 1,
            strength: current.strength * (edge?.strength || 1),
          });
        }
      }
    }

    return traversals;
  }

  findShortestPath(startId: string, endId: string): string[] | null {
    if (startId === endId) return [startId];

    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = [{ id: startId, path: [startId] }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current.id)) continue;
      visited.add(current.id);

      const neighbors = this.adjacency.get(current.id) || new Set();
      for (const neighborId of neighbors) {
        if (neighborId === endId) {
          return [...current.path, neighborId];
        }
        if (!visited.has(neighborId)) {
          queue.push({
            id: neighborId,
            path: [...current.path, neighborId],
          });
        }
      }
    }

    return null;
  }

  findStrongestPath(startId: string, endId: string, maxDepth = 10): GraphTraversal | null {
    let best: GraphTraversal | null = null;
    const visited = new Set<string>();

    const dfs = (currentId: string, path: string[], strength: number, depth: number) => {
      if (depth > maxDepth) return;
      if (currentId === endId) {
        if (!best || strength > best.totalStrength) {
          best = {
            path: [...path],
            totalStrength: strength,
            depth,
            timestamp: Date.now(),
          };
        }
        return;
      }

      visited.add(currentId);

      const neighbors = this.adjacency.get(currentId) || new Set();
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          const edge = this.getEdge(currentId, neighborId);
          dfs(
            neighborId,
            [...path, neighborId],
            strength * (edge?.strength || 1),
            depth + 1
          );
        }
      }

      visited.delete(currentId);
    };

    dfs(startId, [startId], 1.0, 0);
    return best;
  }

  // Clustering
  updateClusters(): void {
    // Simple clustering by node type and connectivity
    this.clusters.clear();
    const visited = new Set<string>();

    for (const [nodeId, node] of this.nodes) {
      if (visited.has(nodeId)) continue;

      const clusterMembers: string[] = [];
      const queue = [nodeId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        
        const currentNode = this.nodes.get(current);
        if (!currentNode || currentNode.type !== node.type) continue;

        visited.add(current);
        clusterMembers.push(current);

        const neighbors = this.getNeighbors(current);
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor.id) && neighbor.type === node.type) {
            queue.push(neighbor.id);
          }
        }
      }

      if (clusterMembers.length > 1) {
        const clusterId = `cluster_${node.type}_${Date.now()}`;
        this.clusters.set(clusterId, {
          id: clusterId,
          centroid: clusterMembers[0],
          members: clusterMembers,
          coherence: this.calculateClusterCoherence(clusterMembers),
          density: this.calculateClusterDensity(clusterMembers),
        });

        // Update nodes with cluster assignment
        for (const memberId of clusterMembers) {
          const member = this.nodes.get(memberId);
          if (member) member.cluster = clusterId;
        }
      }
    }
  }

  private calculateClusterCoherence(members: string[]): number {
    if (members.length < 2) return 1;

    let totalStrength = 0;
    let edgeCount = 0;

    for (const source of members) {
      for (const target of members) {
        if (source !== target) {
          const edge = this.getEdge(source, target);
          if (edge) {
            totalStrength += edge.strength;
            edgeCount++;
          }
        }
      }
    }

    return edgeCount > 0 ? totalStrength / edgeCount : 0;
  }

  private calculateClusterDensity(members: string[]): number {
    if (members.length < 2) return 1;

    const maxEdges = members.length * (members.length - 1);
    let actualEdges = 0;

    for (const source of members) {
      for (const target of members) {
        if (source !== target && this.getEdge(source, target)) {
          actualEdges++;
        }
      }
    }

    return actualEdges / maxEdges;
  }

  getCluster(id: string): ClusterInfo | undefined {
    return this.clusters.get(id);
  }

  getAllClusters(): ClusterInfo[] {
    return Array.from(this.clusters.values());
  }

  // Decay and maintenance
  applyDecay(decayFactor = 0.99): void {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    for (const [, node] of this.nodes) {
      const age = now - node.lastActivated;
      const decay = Math.pow(decayFactor, age / oneDay);
      node.weight = Math.max(node.weight * decay, 0.1);
    }

    for (const [, edge] of this.edges) {
      const age = now - edge.lastTraversed;
      const decay = Math.pow(1 - edge.decayRate, age / oneDay);
      edge.strength = Math.max(edge.strength * decay, 0.1);
    }
  }

  pruneWeakConnections(threshold = 0.2): number {
    let pruned = 0;

    for (const [edgeId, edge] of this.edges) {
      if (edge.strength < threshold) {
        this.edges.delete(edgeId);
        this.adjacency.get(edge.source)?.delete(edge.target);
        this.reverseAdjacency.get(edge.target)?.delete(edge.source);
        pruned++;
      }
    }

    this.persistState();
    return pruned;
  }

  // Metrics and export
  getMetrics(): GraphMetrics {
    const degrees = Array.from(this.adjacency.values()).map(adj => adj.size);
    const avgDegree = degrees.length > 0 
      ? degrees.reduce((a, b) => a + b, 0) / degrees.length 
      : 0;

    const maxPossibleEdges = this.nodes.size * (this.nodes.size - 1);
    const density = maxPossibleEdges > 0 ? this.edges.size / maxPossibleEdges : 0;

    const compressedNodes = Array.from(this.nodes.values()).filter(n => n.compressed);
    const compressionRatio = this.nodes.size > 0 
      ? compressedNodes.length / this.nodes.size 
      : 0;

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      avgDegree,
      density,
      clusterCount: this.clusters.size,
      maxDepth: Math.max(...Array.from(this.nodes.values()).map(n => n.depth), 0),
      compressionRatio,
    };
  }

  exportSnapshot(): { nodes: GraphNode[]; edges: GraphEdge[]; clusters: ClusterInfo[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      clusters: Array.from(this.clusters.values()),
    };
  }

  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  getAllEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  private async persistState(): Promise<void> {
    // Debounced persistence handled by checkpoint manager
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacency.clear();
    this.reverseAdjacency.clear();
    this.clusters.clear();
  }
}

export const memoryGraph = new ContextualMemoryGraph();
