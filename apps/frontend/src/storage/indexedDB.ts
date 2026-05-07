/**
 * IndexedDB Persistence Layer
 * 
 * Provides durable, resumable state persistence for AGROS.
 * Replaces volatile localStorage with structured IndexedDB stores.
 * 
 * Stores:
 * - sessions: Session identity and seed state
 * - checkpoints: Resumable evolution snapshots
 * - manifests: Architecture registry
 * - memory: Semantic memory graph nodes
 * - metrics: Debug telemetry
 */

const DB_NAME = 'agros_persistence';
const DB_VERSION = 1;

export interface SessionRecord {
  id: string;
  seed: string;
  createdAt: number;
  lastActiveAt: number;
  prngState: number;
  checkpointId?: string;
}

export interface CheckpointRecord {
  id: string;
  sessionId: string;
  timestamp: number;
  epoch: number;
  prngState: number;
  evolutionState: EvolutionSnapshot;
  memoryState: MemorySnapshot;
  validated: boolean;
}

export interface EvolutionSnapshot {
  generation: number;
  population: VariantRecord[];
  fitnessHistory: number[];
  mutationLog: MutationRecord[];
  selectionPressure: number;
}

export interface VariantRecord {
  id: string;
  genome: Record<string, number>;
  fitness: number;
  lineage: string[];
  epoch: number;
}

export interface MutationRecord {
  timestamp: number;
  variantId: string;
  gene: string;
  oldValue: number;
  newValue: number;
  mutationType: 'point' | 'crossover' | 'drift';
}

export interface MemorySnapshot {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  compressionLevel: number;
  topologyHash: string;
}

export interface MemoryNode {
  id: string;
  type: 'semantic' | 'emotional' | 'procedural';
  content: string;
  embedding?: number[];
  weight: number;
  timestamp: number;
}

export interface MemoryEdge {
  source: string;
  target: string;
  relation: string;
  strength: number;
}

export interface ManifestRecord {
  id: string;
  version: string;
  timestamp: number;
  components: ComponentManifest[];
  dependencies: DependencyManifest[];
  checksum: string;
}

export interface ComponentManifest {
  name: string;
  path: string;
  type: 'core' | 'service' | 'ui' | 'worker' | 'utility';
  status: 'stable' | 'evolving' | 'deprecated';
  dependencies: string[];
}

export interface DependencyManifest {
  name: string;
  version: string;
  required: boolean;
}

export interface MetricRecord {
  id: string;
  timestamp: number;
  category: 'performance' | 'evolution' | 'memory' | 'error' | 'validation';
  name: string;
  value: number;
  metadata?: Record<string, unknown>;
}

class IndexedDBPersistence {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[AGROS] IndexedDB initialization failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[AGROS] IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('seed', 'seed', { unique: false });
          sessionStore.createIndex('lastActiveAt', 'lastActiveAt', { unique: false });
        }

        // Checkpoints store
        if (!db.objectStoreNames.contains('checkpoints')) {
          const checkpointStore = db.createObjectStore('checkpoints', { keyPath: 'id' });
          checkpointStore.createIndex('sessionId', 'sessionId', { unique: false });
          checkpointStore.createIndex('timestamp', 'timestamp', { unique: false });
          checkpointStore.createIndex('epoch', 'epoch', { unique: false });
        }

        // Manifests store
        if (!db.objectStoreNames.contains('manifests')) {
          const manifestStore = db.createObjectStore('manifests', { keyPath: 'id' });
          manifestStore.createIndex('version', 'version', { unique: false });
          manifestStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Memory store
        if (!db.objectStoreNames.contains('memory')) {
          const memoryStore = db.createObjectStore('memory', { keyPath: 'id' });
          memoryStore.createIndex('sessionId', 'sessionId', { unique: false });
          memoryStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Metrics store
        if (!db.objectStoreNames.contains('metrics')) {
          const metricsStore = db.createObjectStore('metrics', { keyPath: 'id' });
          metricsStore.createIndex('category', 'category', { unique: false });
          metricsStore.createIndex('timestamp', 'timestamp', { unique: false });
          metricsStore.createIndex('name', 'name', { unique: false });
        }

        // Cache store (migration from localStorage)
        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
          cacheStore.createIndex('type', 'type', { unique: false });
        }

        console.log('[AGROS] IndexedDB schema created');
      };
    });

    return this.initPromise;
  }

  private async ensureDB(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) throw new Error('[AGROS] Database not initialized');
    return this.db;
  }

  // Session operations
  async saveSession(session: SessionRecord): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put(session);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const request = tx.objectStore('sessions').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getLatestSession(): Promise<SessionRecord | undefined> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const index = tx.objectStore('sessions').index('lastActiveAt');
      const request = index.openCursor(null, 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        resolve(cursor ? cursor.value : undefined);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllSessions(): Promise<SessionRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const request = tx.objectStore('sessions').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Checkpoint operations
  async saveCheckpoint(checkpoint: CheckpointRecord): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('checkpoints', 'readwrite');
      tx.objectStore('checkpoints').put(checkpoint);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCheckpoint(id: string): Promise<CheckpointRecord | undefined> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('checkpoints', 'readonly');
      const request = tx.objectStore('checkpoints').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getSessionCheckpoints(sessionId: string): Promise<CheckpointRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('checkpoints', 'readonly');
      const index = tx.objectStore('checkpoints').index('sessionId');
      const request = index.getAll(sessionId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getLatestCheckpoint(sessionId: string): Promise<CheckpointRecord | undefined> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('checkpoints', 'readonly');
      const index = tx.objectStore('checkpoints').index('sessionId');
      const request = index.openCursor(IDBKeyRange.only(sessionId), 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        resolve(cursor ? cursor.value : undefined);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Manifest operations
  async saveManifest(manifest: ManifestRecord): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('manifests', 'readwrite');
      tx.objectStore('manifests').put(manifest);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getLatestManifest(): Promise<ManifestRecord | undefined> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('manifests', 'readonly');
      const index = tx.objectStore('manifests').index('timestamp');
      const request = index.openCursor(null, 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        resolve(cursor ? cursor.value : undefined);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Metrics operations
  async recordMetric(metric: Omit<MetricRecord, 'id'>): Promise<void> {
    const db = await this.ensureDB();
    const record: MetricRecord = {
      ...metric,
      id: `${metric.category}_${metric.name}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction('metrics', 'readwrite');
      tx.objectStore('metrics').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMetricsByCategory(category: MetricRecord['category'], limit = 100): Promise<MetricRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('metrics', 'readonly');
      const index = tx.objectStore('metrics').index('category');
      const results: MetricRecord[] = [];
      const request = index.openCursor(IDBKeyRange.only(category), 'prev');
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async pruneOldMetrics(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const db = await this.ensureDB();
    const cutoff = Date.now() - maxAge;
    let count = 0;

    return new Promise((resolve, reject) => {
      const tx = db.transaction('metrics', 'readwrite');
      const index = tx.objectStore('metrics').index('timestamp');
      const request = index.openCursor(IDBKeyRange.upperBound(cutoff));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          count++;
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve(count);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Cache migration from localStorage
  async migrateFromLocalStorage(): Promise<void> {
    const db = await this.ensureDB();
    const stored = localStorage.getItem('slotgpt_cache');
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      const tx = db.transaction('cache', 'readwrite');
      const store = tx.objectStore('cache');

      if (parsed.themeCache) {
        for (const [key, value] of parsed.themeCache) {
          store.put({ key: `theme_${key}`, type: 'theme', value });
        }
      }

      if (parsed.demandCache) {
        for (const [key, value] of parsed.demandCache) {
          store.put({ key: `demand_${key}`, type: 'demand', value });
        }
      }

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      console.log('[AGROS] Migrated localStorage cache to IndexedDB');
    } catch (e) {
      console.warn('[AGROS] Failed to migrate localStorage:', e);
    }
  }

  // Utility
  async clearAll(): Promise<void> {
    const db = await this.ensureDB();
    const stores = ['sessions', 'checkpoints', 'manifests', 'memory', 'metrics', 'cache'];
    
    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  async exportAll(): Promise<Record<string, unknown[]>> {
    const db = await this.ensureDB();
    const stores = ['sessions', 'checkpoints', 'manifests', 'memory', 'metrics'];
    const result: Record<string, unknown[]> = {};

    for (const storeName of stores) {
      result[storeName] = await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const request = tx.objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    return result;
  }
}

export const persistence = new IndexedDBPersistence();
