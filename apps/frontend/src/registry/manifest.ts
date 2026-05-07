/**
 * Architecture Manifest System
 * 
 * Maintains a registry of all system components, their dependencies,
 * status, and versioning. Enables reconstruction and continuation
 * across sessions by documenting the full system topology.
 */

import { persistence, ManifestRecord, ComponentManifest, DependencyManifest } from '../storage/indexedDB';

export interface SystemTopology {
  version: string;
  timestamp: number;
  layers: LayerManifest[];
  integrity: IntegrityState;
}

export interface LayerManifest {
  name: string;
  order: number;
  components: ComponentManifest[];
  status: 'stable' | 'initializing' | 'evolving' | 'degraded';
  dependencies: string[];
}

export interface IntegrityState {
  checksum: string;
  validated: boolean;
  lastValidation: number;
  errors: ValidationError[];
}

export interface ValidationError {
  component: string;
  type: 'missing' | 'incompatible' | 'circular' | 'stale';
  message: string;
  timestamp: number;
}

// AGROS Layer definitions
const AGROS_LAYERS: Omit<LayerManifest, 'status'>[] = [
  {
    name: 'Deterministic Core',
    order: 1,
    components: [
      { name: 'DeterministicPRNG', path: 'utils/prng.ts', type: 'core', status: 'stable', dependencies: [] },
      { name: 'SessionManager', path: 'utils/session.ts', type: 'core', status: 'stable', dependencies: ['DeterministicPRNG'] },
      { name: 'CryptoUtils', path: 'utils/crypto.ts', type: 'utility', status: 'stable', dependencies: [] },
    ],
    dependencies: [],
  },
  {
    name: 'Persistence Layer',
    order: 2,
    components: [
      { name: 'IndexedDBPersistence', path: 'storage/indexedDB.ts', type: 'core', status: 'stable', dependencies: [] },
      { name: 'CacheManager', path: 'cache/index.ts', type: 'service', status: 'evolving', dependencies: ['IndexedDBPersistence'] },
    ],
    dependencies: ['Deterministic Core'],
  },
  {
    name: 'Memory Layer',
    order: 3,
    components: [
      { name: 'MemoryGraph', path: 'memory/graph.ts', type: 'core', status: 'evolving', dependencies: ['IndexedDBPersistence'] },
      { name: 'SemanticCompressor', path: 'memory/compressor.ts', type: 'service', status: 'evolving', dependencies: ['MemoryGraph'] },
    ],
    dependencies: ['Persistence Layer'],
  },
  {
    name: 'Evolution Layer',
    order: 4,
    components: [
      { name: 'EvolutionEngine', path: 'backend:services/evolutionEngine.ts', type: 'core', status: 'stable', dependencies: ['DeterministicPRNG', 'ReinforcementEngine'] },
      { name: 'EvolutionSimulator', path: 'evolution/simulator.ts', type: 'core', status: 'stable', dependencies: ['DeterministicPRNG'] },
      { name: 'MutationEngine', path: 'evolution/mutation.ts', type: 'service', status: 'stable', dependencies: ['EvolutionSimulator'] },
      { name: 'SelectionPipeline', path: 'evolution/selection.ts', type: 'service', status: 'stable', dependencies: ['EvolutionSimulator'] },
    ],
    dependencies: ['Deterministic Core', 'Persistence Layer'],
  },
  {
    name: 'Intent Processing',
    order: 5,
    components: [
      { name: 'IntentVectorEngine', path: 'engine/intentVector.ts', type: 'core', status: 'stable', dependencies: ['DeterministicPRNG'] },
      { name: 'MechanicMapper', path: 'engine/mechanicMapper.ts', type: 'service', status: 'stable', dependencies: ['IntentVectorEngine'] },
      { name: 'ContentRenderer', path: 'engine/contentRenderer.ts', type: 'service', status: 'stable', dependencies: ['IntentVectorEngine', 'MechanicMapper'] },
      { name: 'ScoringEngine', path: 'engine/scoringEngine.ts', type: 'service', status: 'stable', dependencies: [] },
    ],
    dependencies: ['Deterministic Core'],
  },
  {
    name: 'Demand Intelligence',
    order: 6,
    components: [
      { name: 'DemandEngine', path: 'backend:services/demandEngine.ts', type: 'service', status: 'stable', dependencies: [] },
      { name: 'SourceAdapters', path: 'backend:services/demandEngine.ts', type: 'service', status: 'stable', dependencies: ['DemandEngine'] },
      { name: 'TrendAnalyzer', path: 'backend:services/demandEngine.ts', type: 'service', status: 'stable', dependencies: ['SourceAdapters'] },
      { name: 'DemandIntelligencePanel', path: 'components/DemandIntelligencePanel.tsx', type: 'ui', status: 'stable', dependencies: ['DemandEngine'] },
    ],
    dependencies: [],
  },
  {
    name: 'Reinforcement Layer',
    order: 7,
    components: [
      { name: 'ReinforcementEngine', path: 'backend:services/reinforcementEngine.ts', type: 'core', status: 'stable', dependencies: ['DemandEngine', 'ScoringEngine'] },
      { name: 'RewardShaper', path: 'backend:services/reinforcementEngine.ts', type: 'service', status: 'stable', dependencies: ['ReinforcementEngine'] },
      { name: 'ReinforcementGate', path: 'backend:services/reinforcementEngine.ts', type: 'service', status: 'stable', dependencies: ['ReinforcementEngine'] },
      { name: 'ReinforcementReplayVerifier', path: 'backend:services/reinforcementEngine.ts', type: 'service', status: 'stable', dependencies: ['ReinforcementEngine'] },
      { name: 'ReinforcementOptimizerPanel', path: 'components/ReinforcementOptimizerPanel.tsx', type: 'ui', status: 'stable', dependencies: ['ReinforcementEngine'] },
    ],
    dependencies: ['Intent Processing', 'Demand Intelligence'],
  },
  {
    name: 'Context Collapse Compression',
    order: 8,
    components: [
      { name: 'SemanticGraphAbstraction', path: 'cocoon/semanticGraph.ts', type: 'core', status: 'stable', dependencies: ['MemoryGraph', 'ReinforcementEngine'] },
      { name: 'ManifoldEncoder', path: 'cocoon/manifoldEncoder.ts', type: 'service', status: 'stable', dependencies: ['SemanticGraphAbstraction'] },
      { name: 'CocoonStateSerializer', path: 'cocoon/serializer.ts', type: 'service', status: 'stable', dependencies: ['ManifoldEncoder'] },
      { name: 'CompressionMetadataRegistry', path: 'cocoon/metadata.ts', type: 'service', status: 'stable', dependencies: ['CocoonStateSerializer'] },
      { name: 'ContinuityScorer', path: 'cocoon/metadata.ts', type: 'service', status: 'stable', dependencies: ['SemanticGraphAbstraction'] },
      { name: 'ReconstructionVerifier', path: 'cocoon/verifier.ts', type: 'service', status: 'stable', dependencies: ['CocoonStateSerializer', 'CompressionMetadataRegistry'] },
      { name: 'TopologyInspector', path: 'cocoon/verifier.ts', type: 'service', status: 'stable', dependencies: ['ManifoldEncoder'] },
    ],
    dependencies: ['Memory Layer', 'Reinforcement Layer'],
  },
  {
    name: 'STRUTHIO-SEC Mesh',
    order: 9,
    components: [
      { name: 'IntegrityLoop', path: 'struthio/integrity.ts', type: 'core', status: 'evolving', dependencies: [] },
      { name: 'DriftDetector', path: 'struthio/drift.ts', type: 'service', status: 'evolving', dependencies: ['IntegrityLoop'] },
      { name: 'RecoveryEngine', path: 'struthio/recovery.ts', type: 'service', status: 'evolving', dependencies: ['IntegrityLoop', 'IndexedDBPersistence'] },
      { name: 'ConsensusValidator', path: 'struthio/consensus.ts', type: 'service', status: 'evolving', dependencies: ['IntegrityLoop'] },
    ],
    dependencies: ['Persistence Layer', 'Context Collapse Compression'],
  },
  {
    name: 'Debug Layer',
    order: 10,
    components: [
      { name: 'MetricsCollector', path: 'debug/metrics.ts', type: 'service', status: 'stable', dependencies: ['IndexedDBPersistence'] },
      { name: 'TraceLogger', path: 'debug/trace.ts', type: 'service', status: 'stable', dependencies: [] },
      { name: 'ValidationReporter', path: 'debug/validation.ts', type: 'service', status: 'stable', dependencies: ['IntegrityLoop'] },
    ],
    dependencies: ['STRUTHIO-SEC Mesh', 'Persistence Layer'],
  },
  {
    name: 'Visualization Layer',
    order: 11,
    components: [
      { name: 'EvolutionVisualizer', path: 'components/EvolutionVisualizer.tsx', type: 'ui', status: 'stable', dependencies: ['EvolutionEngine'] },
      { name: 'EvolutionSimulatorPanel', path: 'components/EvolutionSimulatorPanel.tsx', type: 'ui', status: 'stable', dependencies: ['EvolutionSimulator'] },
      { name: 'DemandIntelligencePanel', path: 'components/DemandIntelligencePanel.tsx', type: 'ui', status: 'stable', dependencies: ['DemandEngine'] },
      { name: 'ReinforcementOptimizerPanel', path: 'components/ReinforcementOptimizerPanel.tsx', type: 'ui', status: 'stable', dependencies: ['ReinforcementEngine'] },
      { name: 'CocoonDebugPanel', path: 'components/CocoonDebugPanel.tsx', type: 'ui', status: 'stable', dependencies: ['ReconstructionVerifier', 'TopologyInspector'] },
      { name: 'MemoryInspector', path: 'components/MemoryInspector.tsx', type: 'ui', status: 'evolving', dependencies: ['MemoryGraph'] },
      { name: 'DebugPanel', path: 'components/DebugPanel.tsx', type: 'ui', status: 'evolving', dependencies: ['MetricsCollector', 'TraceLogger'] },
    ],
    dependencies: ['Debug Layer', 'Evolution Layer', 'Memory Layer', 'Context Collapse Compression'],
  },
];

class ArchitectureRegistry {
  private topology: SystemTopology | null = null;
  private initialized = false;

  async init(): Promise<SystemTopology> {
    if (this.topology && this.initialized) return this.topology;

    // Try to load from persistence
    const stored = await persistence.getLatestManifest();
    if (stored) {
      this.topology = this.manifestToTopology(stored);
      this.initialized = true;
      return this.topology;
    }

    // Generate fresh topology
    this.topology = this.generateTopology();
    await this.persist();
    this.initialized = true;
    return this.topology;
  }

  private generateTopology(): SystemTopology {
    const timestamp = Date.now();
    const layers: LayerManifest[] = AGROS_LAYERS.map(layer => ({
      ...layer,
      status: this.inferLayerStatus(layer.components),
    }));

    const topology: SystemTopology = {
      version: '0.1.0',
      timestamp,
      layers,
      integrity: {
        checksum: this.computeChecksum(layers),
        validated: false,
        lastValidation: 0,
        errors: [],
      },
    };

    return topology;
  }

  private inferLayerStatus(components: ComponentManifest[]): LayerManifest['status'] {
    const statuses = components.map(c => c.status);
    if (statuses.every(s => s === 'stable')) return 'stable';
    if (statuses.some(s => s === 'deprecated')) return 'degraded';
    return 'evolving';
  }

  private computeChecksum(layers: LayerManifest[]): string {
    const content = JSON.stringify(layers.map(l => ({
      name: l.name,
      components: l.components.map(c => `${c.name}:${c.status}`).sort(),
    })));
    
    // Simple hash for checksum
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private manifestToTopology(manifest: ManifestRecord): SystemTopology {
    // Reconstruct topology from stored manifest
    const layerMap = new Map<string, ComponentManifest[]>();
    
    for (const comp of manifest.components) {
      const layerName = this.inferLayerFromPath(comp.path);
      if (!layerMap.has(layerName)) {
        layerMap.set(layerName, []);
      }
      layerMap.get(layerName)!.push(comp);
    }

    const layers: LayerManifest[] = AGROS_LAYERS.map((layer, index) => ({
      ...layer,
      order: index + 1,
      components: layerMap.get(layer.name) || layer.components,
      status: this.inferLayerStatus(layerMap.get(layer.name) || layer.components),
    }));

    return {
      version: manifest.version,
      timestamp: manifest.timestamp,
      layers,
      integrity: {
        checksum: manifest.checksum,
        validated: true,
        lastValidation: manifest.timestamp,
        errors: [],
      },
    };
  }

  private inferLayerFromPath(path: string): string {
    if (path.includes('utils/') || path.includes('crypto')) return 'Deterministic Core';
    if (path.includes('storage/') || path.includes('cache/')) return 'Persistence Layer';
    if (path.includes('memory/')) return 'Memory Layer';
    if (path.includes('cocoon/') || path.includes('compression/')) return 'Context Collapse Compression';
    if (path.includes('evolution') || path.includes('mutation') || path.includes('selection')) return 'Evolution Layer';
    if (path.includes('intent') || path.includes('mechanic') || path.includes('content') || path.includes('scoring')) return 'Intent Processing';
    if (path.includes('reinforcement') || path.includes('reward')) return 'Reinforcement Layer';
    if (path.includes('demand') || path.includes('trend')) return 'Demand Intelligence';
    if (path.includes('struthio/')) return 'STRUTHIO-SEC Mesh';
    if (path.includes('debug/')) return 'Debug Layer';
    if (path.includes('components/')) return 'Visualization Layer';
    return 'Unknown';
  }

  async persist(): Promise<void> {
    if (!this.topology) return;

    const allComponents = this.topology.layers.flatMap(l => l.components);
    const manifest: ManifestRecord = {
      id: `manifest_${Date.now()}`,
      version: this.topology.version,
      timestamp: this.topology.timestamp,
      components: allComponents,
      dependencies: this.extractDependencies(),
      checksum: this.topology.integrity.checksum,
    };

    await persistence.saveManifest(manifest);
  }

  private extractDependencies(): DependencyManifest[] {
    // Known runtime dependencies
    return [
      { name: 'react', version: '^18.0.0', required: true },
      { name: 'idb', version: '^7.0.0', required: false },
    ];
  }

  async validate(): Promise<ValidationError[]> {
    if (!this.topology) await this.init();
    
    const errors: ValidationError[] = [];
    const componentMap = new Map<string, ComponentManifest>();

    // Build component map
    for (const layer of this.topology!.layers) {
      for (const comp of layer.components) {
        componentMap.set(comp.name, comp);
      }
    }

    // Check dependencies
    for (const layer of this.topology!.layers) {
      for (const comp of layer.components) {
        for (const dep of comp.dependencies) {
          if (!componentMap.has(dep)) {
            errors.push({
              component: comp.name,
              type: 'missing',
              message: `Missing dependency: ${dep}`,
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    // Check layer dependencies
    const layerOrder = new Map(this.topology!.layers.map(l => [l.name, l.order]));
    for (const layer of this.topology!.layers) {
      for (const dep of layer.dependencies) {
        const depOrder = layerOrder.get(dep);
        if (depOrder && depOrder >= layer.order) {
          errors.push({
            component: layer.name,
            type: 'circular',
            message: `Layer depends on higher-order layer: ${dep}`,
            timestamp: Date.now(),
          });
        }
      }
    }

    this.topology!.integrity.errors = errors;
    this.topology!.integrity.validated = errors.length === 0;
    this.topology!.integrity.lastValidation = Date.now();

    return errors;
  }

  getTopology(): SystemTopology | null {
    return this.topology;
  }

  getLayer(name: string): LayerManifest | undefined {
    return this.topology?.layers.find(l => l.name === name);
  }

  getComponent(name: string): ComponentManifest | undefined {
    for (const layer of this.topology?.layers || []) {
      const comp = layer.components.find(c => c.name === name);
      if (comp) return comp;
    }
    return undefined;
  }

  async updateComponentStatus(name: string, status: ComponentManifest['status']): Promise<void> {
    if (!this.topology) await this.init();
    
    for (const layer of this.topology!.layers) {
      const comp = layer.components.find(c => c.name === name);
      if (comp) {
        comp.status = status;
        layer.status = this.inferLayerStatus(layer.components);
        break;
      }
    }

    this.topology!.integrity.checksum = this.computeChecksum(this.topology!.layers);
    await this.persist();
  }

  generateContinuationSummary(): string {
    if (!this.topology) return 'No topology loaded';

    const lines: string[] = [
      `AGROS Architecture v${this.topology.version}`,
      `Generated: ${new Date(this.topology.timestamp).toISOString()}`,
      `Checksum: ${this.topology.integrity.checksum}`,
      '',
      'Layer Status:',
    ];

    for (const layer of this.topology.layers) {
      const stableCount = layer.components.filter(c => c.status === 'stable').length;
      lines.push(`  ${layer.order}. ${layer.name}: ${layer.status} (${stableCount}/${layer.components.length} stable)`);
    }

    if (this.topology.integrity.errors.length > 0) {
      lines.push('', 'Validation Errors:');
      for (const err of this.topology.integrity.errors) {
        lines.push(`  - [${err.type}] ${err.component}: ${err.message}`);
      }
    }

    return lines.join('\n');
  }
}

export const registry = new ArchitectureRegistry();
