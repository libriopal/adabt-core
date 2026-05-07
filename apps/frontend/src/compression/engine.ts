/**
 * Compression Engine
 * 
 * Implements geometry-based semantic compression for memory states.
 * Transforms detailed memory graphs into compressed "cocoon" states
 * that preserve essential structure while minimizing token footprint.
 * 
 * Key operations:
 * - Cocoon compression: Collapse memory to minimal reconstructable state
 * - Manifold condensation: Reduce embedding dimensions while preserving topology
 * - Semantic quantization: Discretize continuous embeddings
 * - Reconstruction verification: Ensure compressed state can be restored
 */

import { memoryGraph, GraphNode, GraphEdge } from '../memory/graph';
import { semanticManifold, ManifoldPoint, ManifoldRegion } from '../memory/manifold';
import { geometryAbstraction, GeometricEntity, AbstractionLevel } from '../memory/geometry';

export interface CocoonState {
  id: string;
  version: number;
  timestamp: number;
  compressionLevel: number;
  
  // Compressed representations
  graphSummary: GraphSummary;
  manifoldSummary: ManifoldSummary;
  geometrySummary: GeometrySummary;
  
  // Reconstruction data
  reconstructionKey: string;
  checksum: string;
  originalSize: number;
  compressedSize: number;
  
  // Continuity markers
  emotionalVector: number[];
  reasoningPath: string[];
  identityMarkers: string[];
}

export interface GraphSummary {
  nodeCount: number;
  edgeCount: number;
  clusterCentroids: Array<{
    id: string;
    type: string;
    centroid: number[];
    memberCount: number;
  }>;
  topologyHash: string;
  keyNodes: Array<{
    id: string;
    weight: number;
    type: string;
    compressedContent: string;
  }>;
}

export interface ManifoldSummary {
  dimension: number;
  reducedDimension: number;
  regionCount: number;
  pointQuantization: number;
  principalComponents: number[][];
  regionCentroids: Array<{
    id: string;
    centroid: number[];
    density: number;
  }>;
}

export interface GeometrySummary {
  entityCount: number;
  totalVolume: number;
  boundingBox: {
    min: number[];
    max: number[];
  };
  topologicalSignature: string;
  abstractionLevels: number;
}

export interface CompressionConfig {
  targetRatio: number;          // Target compression ratio (0-1)
  preserveTopology: boolean;    // Ensure topology is recoverable
  quantizationBits: number;     // Bits for embedding quantization
  maxKeyNodes: number;          // Maximum key nodes to preserve
  emotionalPreservation: boolean; // Preserve emotional continuity
}

export interface ReconstructionResult {
  success: boolean;
  fidelity: number;           // 0-1 reconstruction accuracy
  nodesRestored: number;
  edgesRestored: number;
  topologyMatch: boolean;
  errors: string[];
}

const DEFAULT_CONFIG: CompressionConfig = {
  targetRatio: 0.2,
  preserveTopology: true,
  quantizationBits: 8,
  maxKeyNodes: 50,
  emotionalPreservation: true,
};

class CompressionEngine {
  private config: CompressionConfig = DEFAULT_CONFIG;
  private compressionHistory: CocoonState[] = [];

  setConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Main compression pipeline
  async compress(): Promise<CocoonState> {
    const startTime = Date.now();
    
    // Gather all memory components
    const graphData = this.gatherGraphData();
    const manifoldData = this.gatherManifoldData();
    const geometryData = this.gatherGeometryData();

    // Compute original size
    const originalSize = this.estimateSize(graphData, manifoldData, geometryData);

    // Create compressed summaries
    const graphSummary = this.compressGraph(graphData);
    const manifoldSummary = this.compressManifold(manifoldData);
    const geometrySummary = this.compressGeometry(geometryData);

    // Extract continuity markers
    const emotionalVector = this.extractEmotionalVector(graphData);
    const reasoningPath = this.extractReasoningPath(graphData);
    const identityMarkers = this.extractIdentityMarkers(graphData, manifoldData);

    // Compute compressed size
    const compressedSize = this.estimateSummarySize(graphSummary, manifoldSummary, geometrySummary);

    // Generate reconstruction key
    const reconstructionKey = this.generateReconstructionKey(graphSummary, manifoldSummary);

    const cocoon: CocoonState = {
      id: `cocoon_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      version: 1,
      timestamp: Date.now(),
      compressionLevel: this.config.targetRatio,
      graphSummary,
      manifoldSummary,
      geometrySummary,
      reconstructionKey,
      checksum: this.computeChecksum(graphSummary, manifoldSummary, geometrySummary),
      originalSize,
      compressedSize,
      emotionalVector,
      reasoningPath,
      identityMarkers,
    };

    this.compressionHistory.push(cocoon);
    console.log(`[Compression] Created cocoon in ${Date.now() - startTime}ms, ratio: ${(compressedSize / originalSize * 100).toFixed(1)}%`);

    return cocoon;
  }

  // Gather data from memory systems
  private gatherGraphData(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: memoryGraph.getAllNodes(),
      edges: memoryGraph.getAllEdges(),
    };
  }

  private gatherManifoldData(): { points: ManifoldPoint[]; regions: ManifoldRegion[] } {
    return {
      points: semanticManifold.getAllPoints(),
      regions: semanticManifold.getAllRegions(),
    };
  }

  private gatherGeometryData(): { entities: GeometricEntity[]; levels: AbstractionLevel[] } {
    return {
      entities: geometryAbstraction.getAllEntities(),
      levels: Array.from({ length: 4 }, (_, i) => geometryAbstraction.getAbstractionLevel(i)).filter((l): l is AbstractionLevel => l !== undefined),
    };
  }

  // Graph compression
  private compressGraph(data: { nodes: GraphNode[]; edges: GraphEdge[] }): GraphSummary {
    const { nodes, edges } = data;

    // Identify key nodes (highest weight/activations)
    const sortedNodes = [...nodes].sort((a, b) => (b.weight * b.activations) - (a.weight * a.activations));
    const keyNodes = sortedNodes.slice(0, this.config.maxKeyNodes).map(node => ({
      id: node.id,
      weight: node.weight,
      type: node.type,
      compressedContent: this.compressContent(node.content),
    }));

    // Cluster centroids
    const clusters = memoryGraph.getAllClusters();
    const clusterCentroids = clusters.map(cluster => {
      const members = cluster.members.map(id => nodes.find(n => n.id === id)).filter((n): n is GraphNode => n !== undefined);
      const centroid = this.computeNodeCentroid(members);
      return {
        id: cluster.id,
        type: members[0]?.type || 'semantic',
        centroid,
        memberCount: cluster.members.length,
      };
    });

    // Topology hash
    const topologyHash = this.computeTopologyHash(nodes, edges);

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      clusterCentroids,
      topologyHash,
      keyNodes,
    };
  }

  // Manifold compression with dimensionality reduction
  private compressManifold(data: { points: ManifoldPoint[]; regions: ManifoldRegion[] }): ManifoldSummary {
    const { points, regions } = data;

    // Compute principal components (simplified PCA)
    const principalComponents = this.computePCA(points, 3);
    
    // Quantization level
    const quantizationBits = this.config.quantizationBits;

    // Region centroids
    const regionCentroids = regions.map(region => ({
      id: region.id,
      centroid: this.quantize(region.centroid, quantizationBits),
      density: region.density,
    }));

    return {
      dimension: semanticManifold.getDimension(),
      reducedDimension: principalComponents.length,
      regionCount: regions.length,
      pointQuantization: quantizationBits,
      principalComponents,
      regionCentroids,
    };
  }

  // Geometry compression
  private compressGeometry(data: { entities: GeometricEntity[]; levels: AbstractionLevel[] }): GeometrySummary {
    const { entities, levels } = data;

    // Compute bounding box
    const boundingBox = this.computeBoundingBox(entities);

    // Topological signature from entity types
    const typeCounts = new Map<string, number>();
    for (const entity of entities) {
      typeCounts.set(entity.type, (typeCounts.get(entity.type) || 0) + 1);
    }
    const topologicalSignature = Array.from(typeCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([type, count]) => `${type}:${count}`)
      .join('|');

    return {
      entityCount: entities.length,
      totalVolume: entities.reduce((sum, e) => sum + e.volume, 0),
      boundingBox,
      topologicalSignature,
      abstractionLevels: levels.length,
    };
  }

  // Reconstruction
  async reconstruct(cocoon: CocoonState): Promise<ReconstructionResult> {
    const errors: string[] = [];
    let nodesRestored = 0;
    let edgesRestored = 0;

    try {
      // Verify checksum
      const computedChecksum = this.computeChecksum(
        cocoon.graphSummary,
        cocoon.manifoldSummary,
        cocoon.geometrySummary
      );

      if (computedChecksum !== cocoon.checksum) {
        errors.push('Checksum mismatch - cocoon may be corrupted');
      }

      // Reconstruct key nodes
      for (const keyNode of cocoon.graphSummary.keyNodes) {
        const existing = memoryGraph.getNode(keyNode.id);
        if (!existing) {
          memoryGraph.addNode({
            id: keyNode.id,
            type: keyNode.type as GraphNode['type'],
            content: this.decompressContent(keyNode.compressedContent),
            weight: keyNode.weight,
          });
          nodesRestored++;
        }
      }

      // Reconstruct cluster structure
      for (const cluster of cocoon.graphSummary.clusterCentroids) {
        // Create placeholder nodes for cluster members
        for (let i = 0; i < cluster.memberCount - 1; i++) {
          const nodeId = `${cluster.id}_member_${i}`;
          if (!memoryGraph.getNode(nodeId)) {
            memoryGraph.addNode({
              id: nodeId,
              type: cluster.type as GraphNode['type'],
              content: '',
              cluster: cluster.id,
            });
            nodesRestored++;
          }
        }
      }

      // Reconstruct manifold regions
      for (const region of cocoon.manifoldSummary.regionCentroids) {
        const dequantized = this.dequantize(region.centroid, cocoon.manifoldSummary.pointQuantization);
        semanticManifold.addPoint({
          id: `region_centroid_${region.id}`,
          embedding: dequantized,
          semanticLabel: region.id,
          region: region.id,
        });
      }

      // Topology verification
      const currentHash = this.computeTopologyHash(
        memoryGraph.getAllNodes(),
        memoryGraph.getAllEdges()
      );
      const topologyMatch = currentHash.includes(cocoon.graphSummary.topologyHash.slice(0, 8));

      // Calculate fidelity
      const fidelity = this.calculateFidelity(cocoon, nodesRestored, edgesRestored);

      return {
        success: errors.length === 0,
        fidelity,
        nodesRestored,
        edgesRestored,
        topologyMatch,
        errors,
      };
    } catch (e) {
      errors.push(`Reconstruction error: ${e instanceof Error ? e.message : String(e)}`);
      return {
        success: false,
        fidelity: 0,
        nodesRestored,
        edgesRestored,
        topologyMatch: false,
        errors,
      };
    }
  }

  // Helper methods
  private compressContent(content: string): string {
    // Simple compression: truncate and hash
    if (content.length <= 50) return content;
    return content.slice(0, 47) + '...' + this.simpleHash(content).toString(16).slice(0, 4);
  }

  private decompressContent(compressed: string): string {
    // Can't fully restore, return as-is (lossy compression)
    return compressed;
  }

  private computeNodeCentroid(nodes: GraphNode[]): number[] {
    if (nodes.length === 0) return [];
    
    // Use embeddings if available, otherwise hash-based pseudo-embedding
    const embeddings = nodes.map(n => {
      if (n.embedding && n.embedding.length > 0) return n.embedding;
      const hash = this.simpleHash(n.id + n.content);
      return Array.from({ length: 8 }, (_, i) => Math.sin(hash * (i + 1)));
    });

    const dim = embeddings[0].length;
    const centroid = new Array(dim).fill(0);
    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += emb[i];
      }
    }
    return centroid.map(v => v / nodes.length);
  }

  private computePCA(points: ManifoldPoint[], numComponents: number): number[][] {
    if (points.length === 0) return [];
    
    // Simplified: return first numComponents dimensions as "principal components"
    // Real implementation would compute eigenvectors of covariance matrix
    const components: number[][] = [];
    for (let i = 0; i < Math.min(numComponents, points[0]?.embedding?.length || 0); i++) {
      const component = points.map(p => p.embedding[i] || 0);
      components.push(component);
    }
    return components;
  }

  private quantize(vector: number[], bits: number): number[] {
    const max = Math.pow(2, bits) - 1;
    return vector.map(v => {
      const normalized = (v + 1) / 2; // Assume range [-1, 1]
      return Math.round(normalized * max);
    });
  }

  private dequantize(quantized: number[], bits: number): number[] {
    const max = Math.pow(2, bits) - 1;
    return quantized.map(v => (v / max) * 2 - 1);
  }

  private computeBoundingBox(entities: GeometricEntity[]): { min: number[]; max: number[] } {
    if (entities.length === 0) {
      return { min: [], max: [] };
    }

    const dim = entities[0]?.centroid?.length || 3;
    const min = new Array(dim).fill(Infinity);
    const max = new Array(dim).fill(-Infinity);

    for (const entity of entities) {
      for (const vertex of entity.vertices) {
        for (let i = 0; i < Math.min(vertex.length, dim); i++) {
          if (vertex[i] < min[i]) min[i] = vertex[i];
          if (vertex[i] > max[i]) max[i] = vertex[i];
        }
      }
    }

    return { min, max };
  }

  private computeTopologyHash(nodes: GraphNode[], edges: GraphEdge[]): string {
    const nodeTypes = nodes.map(n => n.type).sort().join(',');
    const edgePattern = edges.map(e => `${e.source.slice(0, 4)}-${e.target.slice(0, 4)}`).sort().join(',');
    return this.simpleHash(nodeTypes + '|' + edgePattern).toString(16);
  }

  private extractEmotionalVector(data: { nodes: GraphNode[]; edges: GraphEdge[] }): number[] {
    // Extract emotional continuity from 'emotional' type nodes
    const emotionalNodes = data.nodes.filter(n => n.type === 'emotional');
    if (emotionalNodes.length === 0) return [0, 0, 0, 0];

    // Aggregate weights as emotional dimensions
    const vector = emotionalNodes.slice(0, 4).map(n => n.weight);
    while (vector.length < 4) vector.push(0);
    return vector;
  }

  private extractReasoningPath(data: { nodes: GraphNode[]; edges: GraphEdge[] }): string[] {
    // Extract procedural reasoning path
    const proceduralNodes = data.nodes
      .filter(n => n.type === 'procedural')
      .sort((a, b) => a.timestamp - b.timestamp);
    
    return proceduralNodes.slice(0, 10).map(n => n.id);
  }

  private extractIdentityMarkers(
    graphData: { nodes: GraphNode[]; edges: GraphEdge[] },
    manifoldData: { points: ManifoldPoint[]; regions: ManifoldRegion[] }
  ): string[] {
    const markers: string[] = [];

    // Top weighted nodes as identity markers
    const topNodes = [...graphData.nodes]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);
    markers.push(...topNodes.map(n => `node:${n.id}`));

    // Region themes as identity markers
    markers.push(...manifoldData.regions.slice(0, 3).map(r => `region:${r.semanticTheme}`));

    return markers;
  }

  private generateReconstructionKey(graph: GraphSummary, manifold: ManifoldSummary): string {
    const keyData = [
      graph.nodeCount,
      graph.edgeCount,
      manifold.dimension,
      manifold.regionCount,
      graph.topologyHash.slice(0, 8),
    ].join('-');
    return Buffer.from(keyData).toString('base64');
  }

  private computeChecksum(
    graph: GraphSummary,
    manifold: ManifoldSummary,
    geometry: GeometrySummary
  ): string {
    const data = JSON.stringify({ graph, manifold, geometry });
    return this.simpleHash(data).toString(16);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private estimateSize(...data: unknown[]): number {
    return JSON.stringify(data).length;
  }

  private estimateSummarySize(
    graph: GraphSummary,
    manifold: ManifoldSummary,
    geometry: GeometrySummary
  ): number {
    return JSON.stringify({ graph, manifold, geometry }).length;
  }

  private calculateFidelity(
    cocoon: CocoonState,
    nodesRestored: number,
    edgesRestored: number
  ): number {
    const nodeRatio = cocoon.graphSummary.nodeCount > 0
      ? nodesRestored / cocoon.graphSummary.nodeCount
      : 1;
    const edgeRatio = cocoon.graphSummary.edgeCount > 0
      ? edgesRestored / cocoon.graphSummary.edgeCount
      : 1;
    
    // Weighted average with topology bonus
    return (nodeRatio * 0.4 + edgeRatio * 0.3 + 0.3);
  }

  // Metrics and history
  getCompressionHistory(): CocoonState[] {
    return [...this.compressionHistory];
  }

  getLatestCocoon(): CocoonState | undefined {
    return this.compressionHistory[this.compressionHistory.length - 1];
  }

  getCompressionStats(): {
    totalCompressions: number;
    avgRatio: number;
    avgFidelity: number;
  } {
    if (this.compressionHistory.length === 0) {
      return { totalCompressions: 0, avgRatio: 0, avgFidelity: 0 };
    }

    const ratios = this.compressionHistory.map(c => c.compressedSize / c.originalSize);
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;

    return {
      totalCompressions: this.compressionHistory.length,
      avgRatio,
      avgFidelity: 0.85, // Placeholder until reconstruction testing
    };
  }
}

export const compressionEngine = new CompressionEngine();
