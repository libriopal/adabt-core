/**
 * Semantic Manifold Storage
 * 
 * Represents memory as a continuous geometric manifold in high-dimensional space.
 * Supports embedding storage, similarity search, and manifold operations.
 * 
 * Key concepts:
 * - Points: Individual semantic memories with vector embeddings
 * - Regions: Areas of the manifold with shared semantic properties
 * - Geodesics: Shortest paths between points on the manifold
 * - Curvature: Local complexity/density of semantic space
 */

export interface ManifoldPoint {
  id: string;
  embedding: number[];
  magnitude: number;
  semanticLabel: string;
  timestamp: number;
  region?: string;
  curvature: number;
  neighbors: string[];
  metadata: Record<string, unknown>;
}

export interface ManifoldRegion {
  id: string;
  centroid: number[];
  radius: number;
  density: number;
  memberCount: number;
  semanticTheme: string;
  boundaries: number[][];
  subregions: string[];
}

export interface Geodesic {
  id: string;
  sourceId: string;
  targetId: string;
  path: string[];
  distance: number;
  curvatureIntegral: number;
  timestamp: number;
}

export interface ManifoldMetrics {
  dimension: number;
  pointCount: number;
  regionCount: number;
  avgDensity: number;
  totalVolume: number;
  avgCurvature: number;
  geodesicCount: number;
}

export interface SimilarityResult {
  id: string;
  similarity: number;
  distance: number;
  point: ManifoldPoint;
}

class SemanticManifold {
  private points: Map<string, ManifoldPoint> = new Map();
  private regions: Map<string, ManifoldRegion> = new Map();
  private geodesics: Map<string, Geodesic> = new Map();
  private dimension: number = 128; // Default embedding dimension
  private kdTree: KDTreeNode | null = null;

  setDimension(dim: number): void {
    this.dimension = dim;
  }

  getDimension(): number {
    return this.dimension;
  }

  // Point operations
  addPoint(point: Partial<ManifoldPoint> & { id: string; embedding: number[] }): ManifoldPoint {
    const fullPoint: ManifoldPoint = {
      magnitude: this.computeMagnitude(point.embedding),
      semanticLabel: '',
      timestamp: Date.now(),
      curvature: 0,
      neighbors: [],
      metadata: {},
      ...point,
    };

    this.points.set(fullPoint.id, fullPoint);
    this.invalidateKDTree();
    
    // Compute local curvature
    this.updateLocalCurvature(fullPoint.id);
    
    return fullPoint;
  }

  getPoint(id: string): ManifoldPoint | undefined {
    return this.points.get(id);
  }

  updatePoint(id: string, updates: Partial<ManifoldPoint>): ManifoldPoint | undefined {
    const point = this.points.get(id);
    if (!point) return undefined;

    const updated = { ...point, ...updates };
    if (updates.embedding) {
      updated.magnitude = this.computeMagnitude(updates.embedding);
      this.invalidateKDTree();
    }
    
    this.points.set(id, updated);
    return updated;
  }

  removePoint(id: string): boolean {
    const removed = this.points.delete(id);
    if (removed) {
      this.invalidateKDTree();
      // Remove from neighbor lists
      for (const [, point] of this.points) {
        point.neighbors = point.neighbors.filter(n => n !== id);
      }
    }
    return removed;
  }

  // Vector operations
  private computeMagnitude(embedding: number[]): number {
    return Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  }

  private normalize(embedding: number[]): number[] {
    const mag = this.computeMagnitude(embedding);
    return mag > 0 ? embedding.map(v => v / mag) : embedding;
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dot = 0;
    let magA = 0;
    let magB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom > 0 ? dot / denom : 0;
  }

  euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) return Infinity;
    
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  // Similarity search
  findSimilar(embedding: number[], k = 10, threshold = 0): SimilarityResult[] {
    const results: SimilarityResult[] = [];

    for (const [id, point] of this.points) {
      const similarity = this.cosineSimilarity(embedding, point.embedding);
      if (similarity >= threshold) {
        results.push({
          id,
          similarity,
          distance: this.euclideanDistance(embedding, point.embedding),
          point,
        });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }

  findNearest(embedding: number[], k = 10): SimilarityResult[] {
    const results: SimilarityResult[] = [];

    for (const [id, point] of this.points) {
      const distance = this.euclideanDistance(embedding, point.embedding);
      results.push({
        id,
        similarity: this.cosineSimilarity(embedding, point.embedding),
        distance,
        point,
      });
    }

    return results
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k);
  }

  // Update neighbor relationships
  updateNeighbors(k = 5): void {
    for (const [id, point] of this.points) {
      const nearest = this.findNearest(point.embedding, k + 1)
        .filter(r => r.id !== id)
        .slice(0, k);
      
      point.neighbors = nearest.map(r => r.id);
    }
  }

  // Local curvature estimation
  private updateLocalCurvature(id: string): void {
    const point = this.points.get(id);
    if (!point || point.neighbors.length < 3) {
      if (point) point.curvature = 0;
      return;
    }

    // Estimate curvature based on neighbor deviation from tangent plane
    const neighbors = point.neighbors
      .map(nid => this.points.get(nid))
      .filter((n): n is ManifoldPoint => n !== undefined);

    if (neighbors.length < 3) {
      point.curvature = 0;
      return;
    }

    // Compute average neighbor distance
    const avgDistance = neighbors.reduce(
      (sum, n) => sum + this.euclideanDistance(point.embedding, n.embedding),
      0
    ) / neighbors.length;

    // Compute variance in distances (proxy for curvature)
    const variance = neighbors.reduce((sum, n) => {
      const dist = this.euclideanDistance(point.embedding, n.embedding);
      return sum + Math.pow(dist - avgDistance, 2);
    }, 0) / neighbors.length;

    point.curvature = Math.sqrt(variance) / (avgDistance + 0.0001);
  }

  // Region operations
  createRegion(centroid: number[], radius: number, theme: string): ManifoldRegion {
    const id = `region_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    // Find all points within radius
    const members = this.findPointsInRadius(centroid, radius);
    
    const region: ManifoldRegion = {
      id,
      centroid,
      radius,
      density: members.length / (Math.PI * radius * radius), // 2D approx
      memberCount: members.length,
      semanticTheme: theme,
      boundaries: this.computeRegionBoundary(centroid, radius),
      subregions: [],
    };

    this.regions.set(id, region);
    
    // Update point region assignments
    for (const member of members) {
      member.point.region = id;
    }

    return region;
  }

  private findPointsInRadius(center: number[], radius: number): SimilarityResult[] {
    const results: SimilarityResult[] = [];

    for (const [id, point] of this.points) {
      const distance = this.euclideanDistance(center, point.embedding);
      if (distance <= radius) {
        results.push({
          id,
          similarity: this.cosineSimilarity(center, point.embedding),
          distance,
          point,
        });
      }
    }

    return results;
  }

  private computeRegionBoundary(centroid: number[], radius: number): number[][] {
    // For visualization: project to 2D and compute boundary points
    const numPoints = 32;
    const boundary: number[][] = [];
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (2 * Math.PI * i) / numPoints;
      boundary.push([
        centroid[0] + radius * Math.cos(angle),
        centroid[1] + radius * Math.sin(angle),
      ]);
    }

    return boundary;
  }

  autoCluster(numClusters = 5): ManifoldRegion[] {
    // K-means clustering
    const points = Array.from(this.points.values());
    if (points.length < numClusters) return [];

    // Initialize centroids randomly
    const centroids: number[][] = [];
    const shuffled = [...points].sort(() => Math.random() - 0.5);
    for (let i = 0; i < numClusters; i++) {
      centroids.push([...shuffled[i].embedding]);
    }

    // Iterate until convergence
    for (let iter = 0; iter < 100; iter++) {
      // Assign points to nearest centroid
      const assignments: number[] = points.map(point => {
        let minDist = Infinity;
        let nearest = 0;
        for (let j = 0; j < centroids.length; j++) {
          const dist = this.euclideanDistance(point.embedding, centroids[j]);
          if (dist < minDist) {
            minDist = dist;
            nearest = j;
          }
        }
        return nearest;
      });

      // Update centroids
      const newCentroids: number[][] = centroids.map(() => 
        new Array(this.dimension).fill(0)
      );
      const counts = new Array(numClusters).fill(0);

      for (let i = 0; i < points.length; i++) {
        const cluster = assignments[i];
        counts[cluster]++;
        for (let d = 0; d < this.dimension; d++) {
          newCentroids[cluster][d] += points[i].embedding[d];
        }
      }

      // Average
      for (let j = 0; j < numClusters; j++) {
        if (counts[j] > 0) {
          for (let d = 0; d < this.dimension; d++) {
            newCentroids[j][d] /= counts[j];
          }
        }
      }

      // Check convergence
      let converged = true;
      for (let j = 0; j < numClusters; j++) {
        if (this.euclideanDistance(centroids[j], newCentroids[j]) > 0.001) {
          converged = false;
        }
        centroids[j] = newCentroids[j];
      }

      if (converged) break;
    }

    // Create regions from clusters
    const regions: ManifoldRegion[] = [];
    for (let j = 0; j < numClusters; j++) {
      const clusterPoints = points.filter((_, i) => {
        let minDist = Infinity;
        let nearest = 0;
        for (let k = 0; k < centroids.length; k++) {
          const dist = this.euclideanDistance(points[i].embedding, centroids[k]);
          if (dist < minDist) {
            minDist = dist;
            nearest = k;
          }
        }
        return nearest === j;
      });

      if (clusterPoints.length === 0) continue;

      // Compute radius as max distance from centroid
      const maxDist = Math.max(
        ...clusterPoints.map(p => this.euclideanDistance(p.embedding, centroids[j]))
      );

      const region = this.createRegion(centroids[j], maxDist, `cluster_${j}`);
      regions.push(region);
    }

    return regions;
  }

  // Geodesic computation
  computeGeodesic(sourceId: string, targetId: string): Geodesic | null {
    const source = this.points.get(sourceId);
    const target = this.points.get(targetId);
    if (!source || !target) return null;

    // A* search using neighbors
    const openSet = new Set([sourceId]);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    gScore.set(sourceId, 0);
    fScore.set(sourceId, this.euclideanDistance(source.embedding, target.embedding));

    while (openSet.size > 0) {
      // Find node with lowest fScore
      let current = '';
      let lowestF = Infinity;
      for (const id of openSet) {
        const f = fScore.get(id) ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = id;
        }
      }

      if (current === targetId) {
        // Reconstruct path
        const path: string[] = [current];
        let curvatureSum = 0;
        
        while (cameFrom.has(current)) {
          const prev = cameFrom.get(current)!;
          const point = this.points.get(current);
          if (point) curvatureSum += point.curvature;
          current = prev;
          path.unshift(current);
        }

        const geodesic: Geodesic = {
          id: `geodesic_${sourceId}_${targetId}`,
          sourceId,
          targetId,
          path,
          distance: gScore.get(targetId) ?? 0,
          curvatureIntegral: curvatureSum,
          timestamp: Date.now(),
        };

        this.geodesics.set(geodesic.id, geodesic);
        return geodesic;
      }

      openSet.delete(current);
      const currentPoint = this.points.get(current);
      if (!currentPoint) continue;

      for (const neighborId of currentPoint.neighbors) {
        const neighbor = this.points.get(neighborId);
        if (!neighbor) continue;

        const tentativeG = (gScore.get(current) ?? Infinity) + 
          this.euclideanDistance(currentPoint.embedding, neighbor.embedding);

        if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
          cameFrom.set(neighborId, current);
          gScore.set(neighborId, tentativeG);
          fScore.set(neighborId, tentativeG + 
            this.euclideanDistance(neighbor.embedding, target.embedding));
          openSet.add(neighborId);
        }
      }
    }

    return null; // No path found
  }

  // Dimensionality reduction (PCA-like projection to 2D/3D)
  projectTo2D(): Array<{ id: string; x: number; y: number; label: string }> {
    const points = Array.from(this.points.values());
    if (points.length === 0) return [];

    // Simple projection using first two dimensions or PCA
    // For now, use first two dimensions with scaling
    const embeddings = points.map(p => p.embedding);
    
    // Find bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const emb of embeddings) {
      if (emb[0] < minX) minX = emb[0];
      if (emb[0] > maxX) maxX = emb[0];
      if (emb[1] < minY) minY = emb[1];
      if (emb[1] > maxY) maxY = emb[1];
    }

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    return points.map((p, i) => ({
      id: p.id,
      x: (embeddings[i][0] - minX) / rangeX,
      y: (embeddings[i][1] - minY) / rangeY,
      label: p.semanticLabel,
    }));
  }

  // Metrics
  getMetrics(): ManifoldMetrics {
    const points = Array.from(this.points.values());
    const avgCurvature = points.length > 0
      ? points.reduce((sum, p) => sum + p.curvature, 0) / points.length
      : 0;

    const regions = Array.from(this.regions.values());
    const avgDensity = regions.length > 0
      ? regions.reduce((sum, r) => sum + r.density, 0) / regions.length
      : 0;

    const totalVolume = regions.reduce((sum, r) => 
      sum + Math.PI * r.radius * r.radius, 0);

    return {
      dimension: this.dimension,
      pointCount: this.points.size,
      regionCount: this.regions.size,
      avgDensity,
      totalVolume,
      avgCurvature,
      geodesicCount: this.geodesics.size,
    };
  }

  // Export/Import
  exportState(): {
    points: ManifoldPoint[];
    regions: ManifoldRegion[];
    geodesics: Geodesic[];
    dimension: number;
  } {
    return {
      points: Array.from(this.points.values()),
      regions: Array.from(this.regions.values()),
      geodesics: Array.from(this.geodesics.values()),
      dimension: this.dimension,
    };
  }

  importState(state: ReturnType<typeof this.exportState>): void {
    this.clear();
    this.dimension = state.dimension;
    
    for (const point of state.points) {
      this.points.set(point.id, point);
    }
    for (const region of state.regions) {
      this.regions.set(region.id, region);
    }
    for (const geodesic of state.geodesics) {
      this.geodesics.set(geodesic.id, geodesic);
    }

    this.invalidateKDTree();
  }

  getAllPoints(): ManifoldPoint[] {
    return Array.from(this.points.values());
  }

  getAllRegions(): ManifoldRegion[] {
    return Array.from(this.regions.values());
  }

  clear(): void {
    this.points.clear();
    this.regions.clear();
    this.geodesics.clear();
    this.kdTree = null;
  }

  private invalidateKDTree(): void {
    this.kdTree = null;
  }
}

// Simple KD-Tree node for spatial indexing (optional optimization)
interface KDTreeNode {
  point: ManifoldPoint;
  left: KDTreeNode | null;
  right: KDTreeNode | null;
  splitDim: number;
}

export const semanticManifold = new SemanticManifold();
