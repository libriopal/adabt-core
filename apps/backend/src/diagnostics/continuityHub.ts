import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from './logger';

export type ContinuityEventType =
  | 'connected'
  | 'heartbeat'
  | 'evolution_interrupted'
  | 'evolution_resumed'
  | 'diagnostic';

export interface ContinuityEvent {
  type: ContinuityEventType;
  timestamp: number;
  payload: Record<string, unknown>;
}

class ContinuityHub {
  private clients = new Set<WebSocket>();
  private events: ContinuityEvent[] = [];
  private interruptedRuns = new Set<string>();
  private maxEvents = 200;

  attach(server: Server): void {
    const wss = new WebSocketServer({ server, path: '/ws/continuity' });

    wss.on('connection', socket => {
      this.clients.add(socket);
      this.send(socket, {
        type: 'connected',
        timestamp: Date.now(),
        payload: {
          protocol: 'agros-continuity-v1',
          replay: 'deterministic',
        },
      });

      socket.on('close', () => {
        this.clients.delete(socket);
      });
    });

    setInterval(() => {
      this.publish({
        type: 'heartbeat',
        timestamp: Date.now(),
        payload: {
          clients: this.clients.size,
          interruptedRuns: this.interruptedRuns.size,
        },
      });
    }, 30_000).unref();
  }

  interrupt(runId: string, reason = 'manual'): ContinuityEvent {
    this.interruptedRuns.add(runId);
    return this.publish({
      type: 'evolution_interrupted',
      timestamp: Date.now(),
      payload: { runId, reason },
    });
  }

  resume(runId: string): ContinuityEvent {
    this.interruptedRuns.delete(runId);
    return this.publish({
      type: 'evolution_resumed',
      timestamp: Date.now(),
      payload: { runId },
    });
  }

  getStatus() {
    return {
      connectedClients: this.clients.size,
      interruptedRuns: Array.from(this.interruptedRuns).sort(),
      recentEvents: this.events.slice(-20),
    };
  }

  publish(event: ContinuityEvent): ContinuityEvent {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    for (const client of this.clients) {
      this.send(client, event);
    }

    logger.info('continuity_event', { eventType: event.type, ...event.payload });
    return event;
  }

  private send(socket: WebSocket, event: ContinuityEvent): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(event));
  }
}

export const continuityHub = new ContinuityHub();
