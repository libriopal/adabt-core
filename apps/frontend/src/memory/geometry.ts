/**
 * Geometry Abstraction System
 * 
 * Transforms semantic memory into geometric representations for compression.
 * Supports multiple geometric primitives and topology transformations.
 * 
 * This is the bridge between semantic content and compressed manifold states.
 */

import { memoryGraph, GraphNode, GraphEdge } from './graph';
import { semanticManifold, ManifoldPoint } from './manifold';

export type GeometricPrimitive = 
  | 'point'
  | 'line'
  | 'triangle'
  | 'tetrahedron'
  | 'simplex'
  | 'hypercube'
  | 'torus';

export interface GeometricEntity {
  id: string;
  type: GeometricPrimitive;
  vertices: number[][];
  centroid: number[];
  volume: number;
  surfaceArea: number;
  orientation: number[];
  topology: TopologyDescriptor;
  sourceNodes: string[];
  timestamp: number;
}

export interface TopologyDescriptor {
  genus: number; // Number of holes
  eulerCharacteristic: number;
  bettieNumbers: number[];
  connected: boolean;
  orientable: boolean;
}

export interface AbstractionLevel {
  level: number;
  name: string;
  entities: GeometricEntity[];
  compressionRatio: number;
  reconstructionFidelity: number;
}

export interface GeometryTransform {
  type: 'translation' | 'rotation' | 'scaling' | 'projection' | 'folding';
  matrix: number[][];
  parameters: Record<string, number>;
}

export interface SimplexComplex {
  id: string;
  dimension: number;
  simplices: Array<{
    id: string;
    vertices: number[];
    faces: string[];
    cofaces: string[];
  }>;
  boundaryMap: Map<string, string[]>;
  homologyGroups: number[][];
}

class GeometryAbstraction {
  private entities: Map<string, GeometricEntity> = new Map();
  private levels: Map<number, AbstractionLevel> = new Map();
  private transforms: GeometryTransform[] = [];
  private simplexComplex: SimplexComplex | null = null;

  // Transform graph nodes to geometric entities
  abstractFromGraph(): GeometricEntity[] {
    const nodes = memoryGraph.getAllNodes();
    const edges = memoryGraph.getAllEdges();
    const created: GeometricEntity[] = [];

    // Create point entities for isolated nodes
    for (const node of nodes) {
      if (node.children.length === 0) {
        const entity = this.createPointEntity(node);
        created.push(entity);
      }
    }

    // Create line entities for simple edges
    for (const edge of edges) {
      const source = memoryGraph.getNode(edge.source);
      const target = memoryGraph.getNode(edge.target);
      if (source && target) {
        const entity = this.createLineEntity(source, target, edge);
        created.push(entity);
      }
    }

    // Create triangle entities for node clusters
    const clusters = memoryGraph.getAllClusters();
    for (const cluster of clusters) {
      if (cluster.members.length >= 3) {
        const entity = this.createTriangleEntity(cluster.members.slice(0, 3));
        created.push(entity);
      }
    }

    return created;
  }

  // Transform manifold points to geometric entities
  abstractFromManifold(): GeometricEntity[] {
    const points = semanticManifold.getAllPoints();
    const regions = semanticManifold.getAllRegions();
    const created: GeometricEntity[] = [];

    // Create simplex entities from point clusters
    for (const region of regions) {
      const regionPoints = points.filter(p => p.region === region.id);
      if (regionPoints.length >= 4) {
        const entity = this.createSimplexEntity(regionPoints);
        created.push(entity);
      } else if (regionPoints.length >= 3) {
        const entity = this.createTriangleFromManifold(regionPoints);
        created.push(entity);
      }
    }

    return created;
  }

  private createPointEntity(node: GraphNode): GeometricEntity {
    const embedding = this.getNodeEmbedding(node);
    const entity: GeometricEntity = {
      id: `geom_point_${node.id}`,
      type: 'point',
      vertices: [embedding],
      centroid: embedding,
      volume: 0,
      surfaceArea: 0,
      orientation: [1, 0, 0],
      topology: {
        genus: 0,
        eulerCharacteristic: 1,
        bettieNumbers: [1],
        connected: true,
        orientable: true,
      },
      sourceNodes: [node.id],
      timestamp: Date.now(),
    };

    this.entities.set(entity.id, entity);
    return entity;
  }

  private createLineEntity(source: GraphNode, target: GraphNode, edge: GraphEdge): GeometricEntity {
    const sourceEmb = this.getNodeEmbedding(source);
    const targetEmb = this.getNodeEmbedding(target);
    const centroid = this.computeCentroid([sourceEmb, targetEmb]);
    const length = this.euclideanDistance(sourceEmb, targetEmb);

    const entity: GeometricEntity = {
      id: `geom_line_${edge.source}_${edge.target}`,
      type: 'line',
      vertices: [sourceEmb, targetEmb],
      centroid,
      volume: 0,
      surfaceArea: length,
      orientation: this.computeDirection(sourceEmb, targetEmb),
      topology: {
        genus: 0,
        eulerCharacteristic: 0,
        bettieNumbers: [1, 0],
        connected: true,
        orientable: true,
      },
      sourceNodes: [source.id, target.id],
      timestamp: Date.now(),
    };

    this.entities.set(entity.id, entity);
    return entity;
  }

  private createTriangleEntity(nodeIds: string[]): GeometricEntity {
    const nodes = nodeIds.map(id => memoryGraph.getNode(id)).filter((n): n is GraphNode => n !== undefined);
    const vertices = nodes.map(n => this.getNodeEmbedding(n));
    const centroid = this.computeCentroid(vertices);
    const area = this.computeTriangleArea(vertices);

    const entity: GeometricEntity = {
      id: `geom_tri_${nodeIds.join('_')}`,
      type: 'triangle',
      vertices,
      centroid,
      volume: 0,
      surfaceArea: area,
      orientation: this.computeNormal(vertices),
      topology: {
        genus: 0,
        eulerCharacteristic: 1,
        bettieNumbers: [1, 0],
        connected: true,
        orientable: true,
      },
      sourceNodes: nodeIds,
      timestamp: Date.now(),
    };

    this.entities.set(entity.id, entity);
    return entity;
  }

  private createTriangleFromManifold(points: ManifoldPoint[]): GeometricEntity {
    const vertices = points.slice(0, 3).map(p => p.embedding);
    const centroid = this.computeCentroid(vertices);
    const area = this.computeTriangleArea(vertices);

    const entity: GeometricEntity = {
      id: `geom_tri_manifold_${Date.now()}`,
      type: 'triangle',
      vertices,
      centroid,
      volume: 0,
      surfaceArea: area,
      orientation: this.computeNormal(vertices),
      topology: {
        genus: 0,
        eulerCharacteristic: 1,
        bettieNumbers: [1, 0],
        connected: true,
        orientable: true,
      },
      sourceNodes: points.map(p => p.id),
      timestamp: Date.now(),
    };

    this.entities.set(entity.id, entity);
    return entity;
  }

  private createSimplexEntity(points: ManifoldPoint[]): GeometricEntity {
    const vertices = points.slice(0, 4).map(p => p.embedding);
    const centroid = this.computeCentroid(vertices);
    const volume = this.computeTetrahedronVolume(vertices);
    const surfaceArea = this.computeTetrahedronSurface(vertices);

    const entity: GeometricEntity = {
      id: `geom_simplex_${Date.now()}`,
      type: 'tetrahedron',
      vertices,
      centroid,
      volume,
      surfaceArea,
      orientation: this.computeNormal(vertices.slice(0, 3)),
      topology: {
        genus: 0,
        eulerCharacteristic: 1,
        bettieNumbers: [1, 0, 0],
        connected: true,
        orientable: true,
      },
      sourceNodes: points.map(p => p.id),
      timestamp: Date.now(),
    };

    this.entities.set(entity.id, entity);
    return entity;
  }

  // Helper: Get or generate embedding for a node
  private getNodeEmbedding(node: GraphNode): number[] {
    if (node.embedding && node.embedding.length > 0) {
      return node.embedding;
    }
    // Generate a deterministic pseudo-embedding from node properties
    const hash = this.hashString(node.id + node.content);
    const dim = 128;
    const embedding: number[] = [];
    for (let i = 0; i < dim; i++) {
      embedding.push(Math.sin(hash * (i + 1)) * Math.cos(hash * (i + 2)));
    }
    return embedding;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) / 2147483647;
  }

  // Geometric computations
  private computeCentroid(vertices: number[][]): number[] {
    if (vertices.length === 0) return [];
    const dim = vertices[0].length;
    const centroid = new Array(dim).fill(0);
    
    for (const v of vertices) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += v[i];
      }
    }
    
    for (let i = 0; i < dim; i++) {
      centroid[i] /= vertices.length;
    }
    
    return centroid;
  }

  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }

  private computeDirection(from: number[], to: number[]): number[] {
    const dir = to.map((v, i) => v - from[i]);
    const mag = Math.sqrt(dir.reduce((sum, v) => sum + v * v, 0));
    return mag > 0 ? dir.map(v => v / mag) : dir;
  }

  private computeNormal(vertices: number[][]): number[] {
    if (vertices.length < 3 || vertices[0].length < 3) {
      return [0, 0, 1];
    }
    
    // Cross product of two edge vectors
    const u = vertices[1].map((v, i) => v - vertices[0][i]);
    const v = vertices[2].map((val, i) => val - vertices[0][i]);
    
    const normal = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    
    const mag = Math.sqrt(normal.reduce((sum, n) => sum + n * n, 0));
    return mag > 0 ? normal.map(n => n / mag) : [0, 0, 1];
  }

  private computeTriangleArea(vertices: number[][]): number {
    if (vertices.length < 3) return 0;
    
    const a = this.euclideanDistance(vertices[0], vertices[1]);
    const b = this.euclideanDistance(vertices[1], vertices[2]);
    const c = this.euclideanDistance(vertices[2], vertices[0]);
    const s = (a + b + c) / 2;
    
    return Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
  }

  private computeTetrahedronVolume(vertices: number[][]): number {
    if (vertices.length < 4) return 0;
    
    // Volume = |det([v1-v4, v2-v4, v3-v4])| / 6
    const v1 = vertices[0].map((v, i) => v - vertices[3][i]);
    const v2 = vertices[1].map((v, i) => v - vertices[3][i]);
    const v3 = vertices[2].map((v, i) => v - vertices[3][i]);
    
    // Scalar triple product
    const det = 
      v1[0] * (v2[1] * v3[2] - v2[2] * v3[1]) -
      v1[1] * (v2[0] * v3[2] - v2[2] * v3[0]) +
      v1[2] * (v2[0] * v3[1] - v2[1] * v3[0]);
    
    return Math.abs(det) / 6;
  }

  private computeTetrahedronSurface(vertices: number[][]): number {
    if (vertices.length < 4) return 0;
    
    // Sum of 4 triangle faces
    const faces = [
      [vertices[0], vertices[1], vertices[2]],
      [vertices[0], vertices[1], vertices[3]],
      [vertices[0], vertices[2], vertices[3]],
      [vertices[1], vertices[2], vertices[3]],
    ];
    
    return faces.reduce((sum, face) => sum + this.computeTriangleArea(face), 0);
  }

  // Abstraction levels
  createAbstractionLevel(level: number, name: string): AbstractionLevel {
    const entities = Array.from(this.entities.values()).filter(e => {
      // Higher levels include larger/more complex entities
      switch (level) {
        case 0: return e.type === 'point';
        case 1: return e.type === 'line' || e.type === 'point';
        case 2: return e.type === 'triangle' || e.type === 'line';
        case 3: return e.type === 'tetrahedron' || e.type === 'triangle';
        default: return true;
      }
    });

    const totalSourceNodes = entities.reduce((sum, e) => sum + e.sourceNodes.length, 0);
    const compressionRatio = totalSourceNodes > 0 ? entities.length / totalSourceNodes : 1;

    const abstractionLevel: AbstractionLevel = {
      level,
      name,
      entities,
      compressionRatio,
      reconstructionFidelity: 1 - (level * 0.1), // Higher levels = lower fidelity
    };

    this.levels.set(level, abstractionLevel);
    return abstractionLevel;
  }

  getAbstractionLevel(level: number): AbstractionLevel | undefined {
    return this.levels.get(level);
  }

  // Transforms
  applyTransform(entityId: string, transform: GeometryTransform): GeometricEntity | undefined {
    const entity = this.entities.get(entityId);
    if (!entity) return undefined;

    const transformed = { ...entity };
    transformed.vertices = entity.vertices.map(v => 
      this.applyMatrixTransform(v, transform.matrix)
    );
    transformed.centroid = this.computeCentroid(transformed.vertices);

    this.transforms.push(transform);
    this.entities.set(entityId, transformed);
    return transformed;
  }

  private applyMatrixTransform(vector: number[], matrix: number[][]): number[] {
    const result: number[] = [];
    for (let i = 0; i < matrix.length; i++) {
      let sum = 0;
      for (let j = 0; j < vector.length && j < matrix[i].length; j++) {
        sum += matrix[i][j] * vector[j];
      }
      result.push(sum);
    }
    return result;
  }

  // Simplicial complex operations
  buildSimplexComplex(): SimplexComplex {
    const entities = Array.from(this.entities.values());
    const simplices: SimplexComplex['simplices'] = [];
    
    // Build simplices from entities
    for (const entity of entities) {
      const simplex = {
        id: entity.id,
        vertices: Array.from({ length: entity.vertices.length }, (_, i) => i),
        faces: [] as string[],
        cofaces: [] as string[],
      };
      simplices.push(simplex);
    }

    this.simplexComplex = {
      id: `complex_${Date.now()}`,
      dimension: Math.max(...entities.map(e => e.vertices.length - 1), 0),
      simplices,
      boundaryMap: new Map(),
      homologyGroups: [],
    };

    return this.simplexComplex;
  }

  // Export for compression
  exportForCompression(): {
    entities: GeometricEntity[];
    levels: AbstractionLevel[];
    transforms: GeometryTransform[];
  } {
    return {
      entities: Array.from(this.entities.values()),
      levels: Array.from(this.levels.values()),
      transforms: [...this.transforms],
    };
  }

  // Metrics
  getMetrics(): {
    entityCount: number;
    levelCount: number;
    totalVolume: number;
    totalSurfaceArea: number;
    avgComplexity: number;
  } {
    const entities = Array.from(this.entities.values());
    
    return {
      entityCount: entities.length,
      levelCount: this.levels.size,
      totalVolume: entities.reduce((sum, e) => sum + e.volume, 0),
      totalSurfaceArea: entities.reduce((sum, e) => sum + e.surfaceArea, 0),
      avgComplexity: entities.length > 0
        ? entities.reduce((sum, e) => sum + e.vertices.length, 0) / entities.length
        : 0,
    };
  }

  getEntity(id: string): GeometricEntity | undefined {
    return this.entities.get(id);
  }

  getAllEntities(): GeometricEntity[] {
    return Array.from(this.entities.values());
  }

  clear(): void {
    this.entities.clear();
    this.levels.clear();
    this.transforms = [];
    this.simplexComplex = null;
  }
}

export const geometryAbstraction = new GeometryAbstraction();
