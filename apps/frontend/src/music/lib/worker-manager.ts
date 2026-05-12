// ─── Worker Lifecycle Manager ───────────────────────────────────────────────
// Manages worker creation, message routing, cancellation, and cleanup.
// Workers are lazily instantiated and torn down on dispose.

import type { WorkerInbound, WorkerOutbound, TelemetryEvent } from '../types/worker-messages';

type MessageHandler = (msg: WorkerOutbound) => void;
type TelemetryHandler = (event: TelemetryEvent) => void;

interface ManagedWorker {
  worker: Worker;
  handlers: Set<MessageHandler>;
  activeSeqId: number | null;
}

let seqCounter = 0;

/** Generate a monotonically increasing sequence ID */
export function nextSeqId(): number {
  return ++seqCounter;
}

export class WorkerManager {
  private workers = new Map<string, ManagedWorker>();
  private telemetryHandlers = new Set<TelemetryHandler>();
  private disposed = false;

  /** Register a new worker by name */
  register(name: string, worker: Worker): void {
    if (this.disposed) throw new Error('WorkerManager is disposed');
    if (this.workers.has(name)) {
      this.terminate(name);
    }

    const managed: ManagedWorker = {
      worker,
      handlers: new Set(),
      activeSeqId: null,
    };

    worker.onmessage = (e: MessageEvent<WorkerOutbound>) => {
      const msg = e.data;

      // Route telemetry separately
      if (msg.type === 'telemetry') {
        this.telemetryHandlers.forEach(h => h(msg as TelemetryEvent));
        return;
      }

      // Dispatch to all handlers
      managed.handlers.forEach(h => h(msg));
    };

    worker.onerror = (err) => {
      console.error(`[WorkerManager] ${name} error:`, err);
    };

    this.workers.set(name, managed);
  }

  /** Send a message to a named worker, with optional transferable objects */
  send(name: string, msg: WorkerInbound, transfer?: Transferable[]): void {
    const managed = this.workers.get(name);
    if (!managed) throw new Error(`Worker "${name}" not registered`);

    if ('seqId' in msg) {
      managed.activeSeqId = msg.seqId;
    }

    managed.worker.postMessage(msg, transfer ?? []);
  }

  /** Cancel the current operation on a worker */
  cancel(name: string): void {
    const managed = this.workers.get(name);
    if (!managed || managed.activeSeqId === null) return;

    managed.worker.postMessage({
      type: 'cancel',
      seqId: managed.activeSeqId,
    });
    managed.activeSeqId = null;
  }

  /** Subscribe to messages from a worker */
  subscribe(name: string, handler: MessageHandler): () => void {
    const managed = this.workers.get(name);
    if (!managed) throw new Error(`Worker "${name}" not registered`);

    managed.handlers.add(handler);
    return () => managed.handlers.delete(handler);
  }

  /** Subscribe to telemetry events from all workers */
  onTelemetry(handler: TelemetryHandler): () => void {
    this.telemetryHandlers.add(handler);
    return () => this.telemetryHandlers.delete(handler);
  }

  /** Terminate a specific worker */
  terminate(name: string): void {
    const managed = this.workers.get(name);
    if (!managed) return;
    managed.worker.terminate();
    managed.handlers.clear();
    this.workers.delete(name);
  }

  /** Check if a worker is registered */
  has(name: string): boolean {
    return this.workers.has(name);
  }

  /** Dispose all workers */
  dispose(): void {
    this.disposed = true;
    for (const [name] of this.workers) {
      this.terminate(name);
    }
    this.telemetryHandlers.clear();
  }
}

/** Singleton worker manager */
export const workerManager = new WorkerManager();
