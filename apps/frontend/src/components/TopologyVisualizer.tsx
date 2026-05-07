/**
 * Topology Visualizer Component
 * 
 * Renders the memory graph, manifold, and compression states
 * as interactive 2D/3D visualizations.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { memoryGraph, GraphNode, GraphEdge, GraphMetrics } from '../memory/graph';
import { semanticManifold, ManifoldMetrics } from '../memory/manifold';
import { compressionEngine, CocoonState } from '../compression/engine';

interface TopologyVisualizerProps {
  width?: number;
  height?: number;
  mode?: 'graph' | 'manifold' | 'compression' | 'combined';
  onNodeSelect?: (nodeId: string) => void;
}

interface VisNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  label: string;
  type: string;
}

interface VisEdge {
  source: string;
  target: string;
  strength: number;
  color: string;
}

interface VisRegion {
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
  label: string;
}

const TYPE_COLORS: Record<string, string> = {
  semantic: '#22D3EE',
  emotional: '#F472B6',
  procedural: '#34D399',
  contextual: '#FBBF24',
  geometric: '#A78BFA',
  default: '#64748B',
};

export const TopologyVisualizer: React.FC<TopologyVisualizerProps> = ({
  width = 600,
  height = 400,
  mode = 'combined',
  onNodeSelect,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visNodes, setVisNodes] = useState<VisNode[]>([]);
  const [visEdges, setVisEdges] = useState<VisEdge[]>([]);
  const [visRegions, setVisRegions] = useState<VisRegion[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [graphMetrics, setGraphMetrics] = useState<GraphMetrics | null>(null);
  const [manifoldMetrics, setManifoldMetrics] = useState<ManifoldMetrics | null>(null);
  const [cocoon, setCocoon] = useState<CocoonState | null>(null);

  // Layout algorithm: Force-directed positioning
  const computeLayout = useCallback(() => {
    const nodes = memoryGraph.getAllNodes();
    const edges = memoryGraph.getAllEdges();
    const points = semanticManifold.getAllPoints();
    const regions = semanticManifold.getAllRegions();

    // Initialize positions
    const positions = new Map<string, { x: number; y: number }>();
    const padding = 50;
    const usableWidth = width - padding * 2;
    const usableHeight = height - padding * 2;

    // Initial random positions
    for (const node of nodes) {
      positions.set(node.id, {
        x: padding + Math.random() * usableWidth,
        y: padding + Math.random() * usableHeight,
      });
    }

    // Force-directed iterations
    const iterations = 50;
    const repulsion = 500;
    const attraction = 0.01;
    const damping = 0.9;

    const velocities = new Map<string, { vx: number; vy: number }>();
    for (const node of nodes) {
      velocities.set(node.id, { vx: 0, vy: 0 });
    }

    for (let iter = 0; iter < iterations; iter++) {
      // Repulsion between all nodes
      for (const nodeA of nodes) {
        const posA = positions.get(nodeA.id)!;
        let fx = 0, fy = 0;

        for (const nodeB of nodes) {
          if (nodeA.id === nodeB.id) continue;
          const posB = positions.get(nodeB.id)!;
          
          const dx = posA.x - posB.x;
          const dy = posA.y - posB.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
          
          fx += (dx / dist) * repulsion / (dist * dist);
          fy += (dy / dist) * repulsion / (dist * dist);
        }

        const vel = velocities.get(nodeA.id)!;
        vel.vx = (vel.vx + fx) * damping;
        vel.vy = (vel.vy + fy) * damping;
      }

      // Attraction along edges
      for (const edge of edges) {
        const posA = positions.get(edge.source);
        const posB = positions.get(edge.target);
        if (!posA || !posB) continue;

        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;

        const fx = dx * attraction * edge.strength;
        const fy = dy * attraction * edge.strength;

        const velA = velocities.get(edge.source);
        const velB = velocities.get(edge.target);
        if (velA) { velA.vx += fx; velA.vy += fy; }
        if (velB) { velB.vx -= fx; velB.vy -= fy; }
      }

      // Apply velocities
      for (const node of nodes) {
        const pos = positions.get(node.id)!;
        const vel = velocities.get(node.id)!;
        
        pos.x = Math.max(padding, Math.min(width - padding, pos.x + vel.vx));
        pos.y = Math.max(padding, Math.min(height - padding, pos.y + vel.vy));
      }
    }

    // Create visualization nodes
    const newVisNodes: VisNode[] = nodes.map(node => {
      const pos = positions.get(node.id)!;
      return {
        id: node.id,
        x: pos.x,
        y: pos.y,
        radius: 6 + Math.min(node.weight * 2, 10),
        color: TYPE_COLORS[node.type] || TYPE_COLORS.default,
        label: node.id.slice(0, 8),
        type: node.type,
      };
    });

    // Create visualization edges
    const newVisEdges: VisEdge[] = edges.map(edge => ({
      source: edge.source,
      target: edge.target,
      strength: edge.strength,
      color: `rgba(100, 116, 139, ${Math.min(edge.strength * 0.3, 0.8)})`,
    }));

    // Create visualization regions from manifold
    const newVisRegions: VisRegion[] = regions.map((region, i) => {
      // Map region centroid to canvas coordinates
      const cx = padding + (region.centroid[0] || 0.5) * usableWidth;
      const cy = padding + (region.centroid[1] || 0.5) * usableHeight;
      const radius = Math.min(region.radius * 100, 80);
      
      return {
        id: region.id,
        cx,
        cy,
        rx: radius,
        ry: radius * 0.8,
        color: `hsla(${(i * 60) % 360}, 70%, 60%, 0.15)`,
        label: region.semanticTheme,
      };
    });

    // Add manifold points as nodes if in manifold/combined mode
    if (mode === 'manifold' || mode === 'combined') {
      for (const point of points) {
        const proj = semanticManifold.projectTo2D().find(p => p.id === point.id);
        if (proj && !positions.has(point.id)) {
          newVisNodes.push({
            id: point.id,
            x: padding + proj.x * usableWidth,
            y: padding + proj.y * usableHeight,
            radius: 4,
            color: '#A78BFA',
            label: point.semanticLabel || point.id.slice(0, 6),
            type: 'manifold',
          });
        }
      }
    }

    setVisNodes(newVisNodes);
    setVisEdges(newVisEdges);
    setVisRegions(newVisRegions);
    setGraphMetrics(memoryGraph.getMetrics());
    setManifoldMetrics(semanticManifold.getMetrics());
    setCocoon(compressionEngine.getLatestCocoon() || null);
  }, [width, height, mode]);

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw regions
    for (const region of visRegions) {
      ctx.fillStyle = region.color;
      ctx.beginPath();
      ctx.ellipse(region.cx, region.cy, region.rx, region.ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Region label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(region.label, region.cx, region.cy);
    }

    // Draw edges
    const nodeMap = new Map(visNodes.map(n => [n.id, n]));
    for (const edge of visEdges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      ctx.strokeStyle = edge.color;
      ctx.lineWidth = Math.max(edge.strength, 0.5);
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    }

    // Draw nodes
    for (const node of visNodes) {
      const isHovered = node.id === hoveredNode;
      const isSelected = node.id === selectedNode;

      // Glow effect for selected/hovered
      if (isHovered || isSelected) {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 15;
      }

      // Node circle
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + (isHovered ? 2 : 0), 0, Math.PI * 2);
      ctx.fill();

      // Border for selected
      if (isSelected) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;

      // Label
      if (isHovered || isSelected) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y - node.radius - 5);
      }
    }

    // Draw compression indicator if available
    if (cocoon && mode === 'compression') {
      const ratio = cocoon.compressedSize / cocoon.originalSize;
      
      ctx.fillStyle = 'rgba(34, 211, 238, 0.1)';
      ctx.fillRect(10, height - 60, 150, 50);
      
      ctx.fillStyle = '#22D3EE';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Compression: ${(ratio * 100).toFixed(1)}%`, 15, height - 42);
      ctx.fillText(`Nodes: ${cocoon.graphSummary.nodeCount}`, 15, height - 28);
      ctx.fillText(`Regions: ${cocoon.manifoldSummary.regionCount}`, 15, height - 14);
    }

  }, [visNodes, visEdges, visRegions, hoveredNode, selectedNode, width, height, mode, cocoon]);

  // Mouse interaction
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find hovered node
    let found: string | null = null;
    for (const node of visNodes) {
      const dx = node.x - x;
      const dy = node.y - y;
      if (dx * dx + dy * dy <= (node.radius + 5) * (node.radius + 5)) {
        found = node.id;
        break;
      }
    }
    setHoveredNode(found);
  }, [visNodes]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredNode) {
      setSelectedNode(hoveredNode === selectedNode ? null : hoveredNode);
      if (onNodeSelect && hoveredNode) {
        onNodeSelect(hoveredNode);
      }
    }
  }, [hoveredNode, selectedNode, onNodeSelect]);

  // Refresh layout
  useEffect(() => {
    computeLayout();
  }, [computeLayout]);

  // Refresh button handler
  const handleRefresh = useCallback(() => {
    computeLayout();
  }, [computeLayout]);

  return (
    <div style={{ 
      background: '#0F172A', 
      borderRadius: 8, 
      padding: 16,
      border: '1px solid rgba(100, 116, 139, 0.2)',
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <h3 style={{ 
          color: '#E2E8F0', 
          fontSize: 14, 
          fontFamily: 'JetBrains Mono, monospace',
          margin: 0,
        }}>
          Topology Visualizer
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleRefresh}
            style={{
              background: 'rgba(34, 211, 238, 0.1)',
              border: '1px solid #22D3EE',
              color: '#22D3EE',
              padding: '4px 12px',
              borderRadius: 4,
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        style={{ 
          borderRadius: 4, 
          cursor: hoveredNode ? 'pointer' : 'default',
        }}
      />

      {/* Metrics panel */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: 12,
        marginTop: 12,
      }}>
        <MetricBox 
          label="Nodes" 
          value={graphMetrics?.nodeCount || 0} 
          color="#22D3EE" 
        />
        <MetricBox 
          label="Edges" 
          value={graphMetrics?.edgeCount || 0} 
          color="#34D399" 
        />
        <MetricBox 
          label="Clusters" 
          value={graphMetrics?.clusterCount || 0} 
          color="#FBBF24" 
        />
        <MetricBox 
          label="Density" 
          value={`${((graphMetrics?.density || 0) * 100).toFixed(1)}%`} 
          color="#F472B6" 
        />
      </div>

      {/* Legend */}
      <div style={{ 
        display: 'flex', 
        gap: 16, 
        marginTop: 12,
        flexWrap: 'wrap',
      }}>
        {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'default').map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              background: color,
            }} />
            <span style={{ 
              color: '#64748B', 
              fontSize: 10, 
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {type}
            </span>
          </div>
        ))}
      </div>

      {/* Selected node info */}
      {selectedNode && (
        <div style={{
          marginTop: 12,
          padding: 12,
          background: 'rgba(100, 116, 139, 0.1)',
          borderRadius: 4,
        }}>
          <div style={{ 
            color: '#E2E8F0', 
            fontSize: 12, 
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            Selected: {selectedNode}
          </div>
        </div>
      )}
    </div>
  );
};

// Metric display box
const MetricBox: React.FC<{ label: string; value: number | string; color: string }> = ({ 
  label, 
  value, 
  color 
}) => (
  <div style={{
    background: 'rgba(100, 116, 139, 0.1)',
    borderRadius: 4,
    padding: 8,
    textAlign: 'center',
  }}>
    <div style={{ 
      color, 
      fontSize: 16, 
      fontWeight: 600, 
      fontFamily: 'JetBrains Mono, monospace',
    }}>
      {value}
    </div>
    <div style={{ 
      color: '#64748B', 
      fontSize: 10, 
      fontFamily: 'JetBrains Mono, monospace',
      marginTop: 2,
    }}>
      {label}
    </div>
  </div>
);

export default TopologyVisualizer;
