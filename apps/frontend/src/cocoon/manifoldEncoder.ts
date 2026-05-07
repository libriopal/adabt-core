import {
  ManifoldEncoder,
  ManifoldEncoding,
  SemanticGraphAbstraction,
  SemanticGraphEdge,
  SemanticGraphNode,
} from './types';
import { round, stableHash } from './semanticGraph';

const DIMENSIONS = [
  'determinism',
  'emotion',
  'reasoning',
  'architecture',
  'topology',
  'reinforcement',
  'recovery',
];

export class DeterministicManifoldEncoder implements ManifoldEncoder {
  name = 'deterministic-transparent-manifold';
  version = 1;

  encode(graph: SemanticGraphAbstraction): ManifoldEncoding {
    const nodes = graph.nodes.map(node => ({
      id: node.id,
      coordinates: encodeCoordinates(node),
      radius: round((node.priority / graph.nodes.length) + node.weight * 0.05),
      anchorMass: round(node.anchors.length / DIMENSIONS.length),
    }));

    const geodesics = graph.edges.map(edge => {
      const source = nodes.find(node => node.id === edge.source);
      const target = nodes.find(node => node.id === edge.target);
      const distance = source && target ? euclidean(source.coordinates, target.coordinates) : 1;
      return {
        source: edge.source,
        target: edge.target,
        distance: round(distance),
        curvature: round(edge.weight / Math.max(distance, 0.01)),
        relation: edge.relation,
      };
    });

    const topology = {
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      connectedComponents: countConnectedComponents(graph.nodes, graph.edges),
      averageDegree: round((graph.edges.length * 2) / Math.max(graph.nodes.length, 1)),
      anchorSignature: stableHash(JSON.stringify(graph.anchorCoverage)),
      checksum: stableHash(JSON.stringify({
        nodes,
        geodesics,
        signature: graph.topologySignature,
      })),
    };

    return {
      encoder: `${this.name}@${this.version}`,
      dimensions: DIMENSIONS,
      nodes,
      geodesics,
      topology,
    };
  }
}

export const deterministicManifoldEncoder = new DeterministicManifoldEncoder();

function encodeCoordinates(node: SemanticGraphNode): number[] {
  const total = node.featureVector.reduce((sum, value) => sum + value, 0) || 1;
  return node.featureVector.map((value, index) => {
    const priorityCurve = 1 / (node.priority + index + 1);
    return round((value / total) * node.weight + priorityCurve * 0.1);
  });
}

function euclidean(left: number[], right: number[]): number {
  const sum = left.reduce((acc, value, index) => {
    const delta = value - (right[index] ?? 0);
    return acc + delta * delta;
  }, 0);
  return Math.sqrt(sum);
}

function countConnectedComponents(nodes: SemanticGraphNode[], edges: SemanticGraphEdge[]): number {
  const adjacency = new Map(nodes.map(node => [node.id, new Set<string>()]));
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const seen = new Set<string>();
  let components = 0;

  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    components++;
    const queue = [node.id];
    seen.add(node.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighbor of adjacency.get(current) || []) {
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  return components;
}
