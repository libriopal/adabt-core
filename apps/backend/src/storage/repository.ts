import { Pool } from 'pg';
import {
  DBDesign,
  DBEvolutionRun,
  DemandResult,
  Design,
  EventLogEntry,
  EvolutionState,
  ReleaseEvidenceRecord,
  ReleaseDecisionRecord,
  ReleaseReconciliationRecord,
  ReinforcementDecision,
  ReplayCheckpoint,
  ReplayMonitorSnapshot,
} from '../types';
import { initDatabase, getDB } from './db';
import {
  resolveDatabaseRuntimeConfig,
  type DatabaseRuntimeConfig,
  type DatabaseProvider,
} from './databaseConfig';
import { runPostgresMigrations } from './migrations';

export interface DesignQueryOptions {
  minScore?: number;
  generation?: number;
  limit?: number;
  offset?: number;
}

export interface DesignStats {
  total: number;
  avgScore: number;
  topScore: number;
}

export type EventLogInput = Omit<EventLogEntry, 'createdAt'> & {
  createdAt?: number;
};

export type ReplayCheckpointInput = Omit<ReplayCheckpoint, 'createdAt'> & {
  createdAt?: number;
};

export type ReplayMonitorSnapshotInput = Omit<ReplayMonitorSnapshot, 'acknowledgedAt' | 'acknowledgedBy'> & {
  acknowledgedAt?: number;
  acknowledgedBy?: string;
};

export type ReleaseEvidenceInput = Omit<ReleaseEvidenceRecord, 'createdAt'> & {
  createdAt?: number;
};

export type ReleaseDecisionInput = Omit<ReleaseDecisionRecord, 'createdAt'> & {
  createdAt?: number;
};

export type ReleaseReconciliationInput = Omit<ReleaseReconciliationRecord, 'createdAt'> & {
  createdAt?: number;
};

export interface ReleaseEvidenceFilters {
  provider?: string;
  status?: ReleaseEvidenceRecord['status'];
  rollbackStatus?: ReleaseEvidenceRecord['rollbackStatus'];
}

export interface ReleaseDecisionFilters {
  provider?: string;
  decision?: ReleaseDecisionRecord['decision'];
}

export interface ReleaseReconciliationFilters {
  provider?: string;
  decisionId?: string;
  commitSha?: string;
}

export interface StorageRepository {
  provider: DatabaseProvider;
  designs: {
    create(design: DBDesign | Design): Promise<void>;
    getById(id: string): Promise<DBDesign | null>;
    getAll(opts?: DesignQueryOptions): Promise<DBDesign[]>;
    getStats(): Promise<DesignStats>;
    updateExported(id: string, exported: boolean): Promise<void>;
  };
  evolutionRuns: {
    create(state: EvolutionState): Promise<void>;
    getById(id: string): Promise<DBEvolutionRun | null>;
    update(id: string, patch: Partial<EvolutionState>): Promise<void>;
  };
  demand: {
    save(result: DemandResult): Promise<void>;
    getLatest(): Promise<DemandResult | null>;
  };
  reinforcement: {
    save(decision: ReinforcementDecision): Promise<void>;
    getLatest(limit?: number): Promise<ReinforcementDecision[]>;
  };
  events: {
    append(event: EventLogInput): Promise<EventLogEntry>;
    getByStream(stream: string, limit?: number): Promise<EventLogEntry[]>;
    getLatest(limit?: number): Promise<EventLogEntry[]>;
  };
  replayCheckpoints: {
    save(checkpoint: ReplayCheckpointInput): Promise<ReplayCheckpoint>;
    getLatest(stream?: string, limit?: number): Promise<ReplayCheckpoint[]>;
    getById(id: string): Promise<ReplayCheckpoint | null>;
  };
  replayMonitorSnapshots: {
    save(snapshot: ReplayMonitorSnapshotInput): Promise<ReplayMonitorSnapshot>;
    getLatest(stream?: string, limit?: number): Promise<ReplayMonitorSnapshot[]>;
    acknowledge(id: string, acknowledgedBy?: string): Promise<ReplayMonitorSnapshot | null>;
  };
  releaseEvidence: {
    save(evidence: ReleaseEvidenceInput): Promise<ReleaseEvidenceRecord>;
    getLatest(stream?: string, limit?: number, filters?: ReleaseEvidenceFilters): Promise<ReleaseEvidenceRecord[]>;
    getById(id: string): Promise<ReleaseEvidenceRecord | null>;
    deleteByIds(ids: string[]): Promise<number>;
  };
  releaseDecisions: {
    save(decision: ReleaseDecisionInput): Promise<ReleaseDecisionRecord>;
    getLatest(stream?: string, limit?: number, filters?: ReleaseDecisionFilters): Promise<ReleaseDecisionRecord[]>;
    getById(id: string): Promise<ReleaseDecisionRecord | null>;
  };
  releaseReconciliations: {
    save(reconciliation: ReleaseReconciliationInput): Promise<ReleaseReconciliationRecord>;
    getLatest(stream?: string, limit?: number, filters?: ReleaseReconciliationFilters): Promise<ReleaseReconciliationRecord[]>;
    getById(id: string): Promise<ReleaseReconciliationRecord | null>;
  };
  close(): Promise<void>;
}

function designToRow(design: DBDesign | Design): Record<string, unknown> {
  return {
    id: design.id,
    seed: design.seed,
    timestamp: design.timestamp,
    input: design.input,
    mode: design.mode,
    intent_vector: JSON.stringify(design.intentVector),
    mechanics: JSON.stringify(design.mechanics),
    content: JSON.stringify(design.content),
    score_total: design.score.total,
    score_demand: design.score.demand,
    score_engagement: design.score.engagement,
    score_novelty: design.score.novelty,
    score_retention: design.score.retention,
    generation: design.generation ?? 0,
    parent_ids: design.parentIds ? JSON.stringify(design.parentIds) : null,
    exported: (design as DBDesign).exported ? 1 : 0,
    archived: (design as DBDesign).archived ? 1 : 0,
  };
}

function rowToDesign(row: any): DBDesign {
  return {
    id: row.id,
    seed: row.seed,
    timestamp: Number(row.timestamp),
    input: row.input,
    mode: row.mode,
    intentVector: JSON.parse(row.intent_vector),
    mechanics: JSON.parse(row.mechanics),
    content: JSON.parse(row.content),
    score: {
      total: Number(row.score_total),
      demand: Number(row.score_demand),
      engagement: Number(row.score_engagement),
      novelty: Number(row.score_novelty),
      retention: Number(row.score_retention),
    },
    generation: Number(row.generation ?? 0),
    parentIds: row.parent_ids ? JSON.parse(row.parent_ids) : undefined,
    exported: Boolean(row.exported),
    archived: Boolean(row.archived),
  };
}

function rowToEvolution(row: any): DBEvolutionRun {
  return {
    runId: row.id,
    currentGeneration: Number(row.current_generation),
    maxGenerations: Number(row.max_generations),
    populationSize: Number(row.population_size),
    mutationRate: Number(row.mutation_rate),
    eliteRatio: Number(row.elite_ratio),
    designs: JSON.parse(row.designs),
    history: JSON.parse(row.history),
    status: row.status,
    config: JSON.parse(row.config),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function rowToDemand(row: any): DemandResult {
  return {
    demandScore: Number(row.demand_score),
    trendVector: JSON.parse(row.trend_vector),
    keywordClusters: JSON.parse(row.keyword_clusters),
    timestamp: Number(row.timestamp),
  };
}

function rowToReinforcement(row: any): ReinforcementDecision {
  return {
    id: row.id,
    designId: row.design_id,
    total: Number(row.total),
    axes: JSON.parse(row.axes),
    weights: JSON.parse(row.weights),
    gate: JSON.parse(row.gate),
    mutationWeight: Number(row.mutation_weight),
    lineage: JSON.parse(row.lineage),
    demandChecksum: row.demand_checksum,
    replayChecksum: row.replay_checksum,
  };
}

function rowToEvent(row: any): EventLogEntry {
  return {
    id: row.id,
    stream: row.stream,
    type: row.type,
    sequence: Number(row.sequence),
    payload: JSON.parse(row.payload),
    replayChecksum: row.replay_checksum,
    createdAt: Number(row.created_at),
  };
}

function rowToReplayCheckpoint(row: any): ReplayCheckpoint {
  return {
    id: row.id,
    stream: row.stream,
    label: row.label,
    eventCount: Number(row.event_count),
    replayChecksum: row.replay_checksum,
    state: JSON.parse(row.state),
    createdAt: Number(row.created_at),
  };
}

function rowToReplayMonitorSnapshot(row: any): ReplayMonitorSnapshot {
  return {
    id: row.id,
    stream: row.stream,
    status: row.status,
    checkedAt: Number(row.checked_at),
    eventCount: Number(row.event_count),
    checkpointCount: Number(row.checkpoint_count),
    latestCheckpointId: row.latest_checkpoint_id ?? undefined,
    alertCount: Number(row.alert_count),
    alerts: JSON.parse(row.alerts),
    report: JSON.parse(row.report),
    acknowledgedAt: row.acknowledged_at === null || row.acknowledged_at === undefined
      ? undefined
      : Number(row.acknowledged_at),
    acknowledgedBy: row.acknowledged_by ?? undefined,
  };
}

function rowToReleaseEvidence(row: any): ReleaseEvidenceRecord {
  return {
    id: row.id,
    stream: row.stream,
    provider: row.provider,
    status: row.status,
    checkedAt: Number(row.checked_at),
    gateCount: Number(row.gate_count),
    blockedGateCount: Number(row.blocked_gate_count),
    degradedGateCount: Number(row.degraded_gate_count),
    latestMonitorSnapshotId: row.latest_monitor_snapshot_id ?? undefined,
    latestAlertSnapshotId: row.latest_alert_snapshot_id ?? undefined,
    rollbackStatus: row.rollback_status,
    latestDegradedExportChecksum: row.latest_degraded_export_checksum ?? undefined,
    report: JSON.parse(row.report),
    createdAt: Number(row.created_at),
  };
}

function rowToReleaseDecision(row: any): ReleaseDecisionRecord {
  return {
    id: row.id,
    evidenceId: row.evidence_id,
    stream: row.stream,
    provider: row.provider,
    decision: row.decision,
    reason: row.reason,
    decidedBy: row.decided_by,
    decidedAt: Number(row.decided_at),
    evidenceChecksum: row.evidence_checksum,
    providerSignature: row.provider_signature,
    decisionSignature: row.decision_signature,
    createdAt: Number(row.created_at),
  };
}

function rowToReleaseReconciliation(row: any): ReleaseReconciliationRecord {
  return {
    id: row.id,
    decisionId: row.decision_id,
    evidenceId: row.evidence_id,
    stream: row.stream,
    provider: row.provider,
    commitSha: row.commit_sha,
    branch: row.branch,
    pullRequestUrl: row.pull_request_url ?? undefined,
    sourceThread: row.source_thread ?? undefined,
    initiatedBy: row.initiated_by ?? undefined,
    decisionSignature: row.decision_signature,
    evidenceChecksum: row.evidence_checksum,
    providerSignature: row.provider_signature,
    reconciliationSignature: row.reconciliation_signature,
    createdAt: Number(row.created_at),
  };
}

export class SqliteStorageRepository implements StorageRepository {
  provider: DatabaseProvider = 'sqlite';

  designs = {
    create: async (design: DBDesign | Design): Promise<void> => {
      const row = designToRow(design);
      getDB().prepare(`
        INSERT OR REPLACE INTO designs
          (id, seed, timestamp, input, mode, intent_vector, mechanics, content,
           score_total, score_demand, score_engagement, score_novelty, score_retention,
           generation, parent_ids, exported, archived)
        VALUES
          (@id, @seed, @timestamp, @input, @mode, @intent_vector, @mechanics, @content,
           @score_total, @score_demand, @score_engagement, @score_novelty, @score_retention,
           @generation, @parent_ids, @exported, @archived)
      `).run(row);
    },
    getById: async (id: string): Promise<DBDesign | null> => {
      const row = getDB().prepare('SELECT * FROM designs WHERE id = ?').get(id) as any;
      return row ? rowToDesign(row) : null;
    },
    getAll: async (opts: DesignQueryOptions = {}): Promise<DBDesign[]> => {
      const conditions: string[] = ['archived = 0'];
      const params: Record<string, any> = {};

      if (opts.minScore !== undefined) {
        conditions.push('score_total >= @minScore');
        params.minScore = opts.minScore;
      }
      if (opts.generation !== undefined) {
        conditions.push('generation = @generation');
        params.generation = opts.generation;
      }

      params.limit = opts.limit ?? 50;
      params.offset = opts.offset ?? 0;
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = getDB()
        .prepare(`SELECT * FROM designs ${where} ORDER BY score_total DESC LIMIT @limit OFFSET @offset`)
        .all(params) as any[];

      return rows.map(rowToDesign);
    },
    getStats: async (): Promise<DesignStats> => {
      const row = getDB()
        .prepare('SELECT COUNT(*) as total, AVG(score_total) as avgScore, MAX(score_total) as topScore FROM designs WHERE archived = 0')
        .get() as any;
      return {
        total: row.total ?? 0,
        avgScore: row.avgScore ?? 0,
        topScore: row.topScore ?? 0,
      };
    },
    updateExported: async (id: string, exported: boolean): Promise<void> => {
      getDB().prepare('UPDATE designs SET exported = ? WHERE id = ?').run(exported ? 1 : 0, id);
    },
  };

  evolutionRuns = {
    create: async (state: EvolutionState): Promise<void> => {
      const now = Date.now();
      getDB().prepare(`
        INSERT INTO evolution_runs
          (id, current_generation, max_generations, population_size, mutation_rate,
           elite_ratio, designs, history, status, config, created_at, updated_at)
        VALUES
          (@id, @current_generation, @max_generations, @population_size, @mutation_rate,
           @elite_ratio, @designs, @history, @status, @config, @created_at, @updated_at)
      `).run({
        id: state.runId,
        current_generation: state.currentGeneration,
        max_generations: state.maxGenerations,
        population_size: state.populationSize,
        mutation_rate: state.mutationRate,
        elite_ratio: state.eliteRatio,
        designs: JSON.stringify(state.designs),
        history: JSON.stringify(state.history),
        status: state.status,
        config: JSON.stringify(state.config),
        created_at: now,
        updated_at: now,
      });
    },
    getById: async (id: string): Promise<DBEvolutionRun | null> => {
      const row = getDB().prepare('SELECT * FROM evolution_runs WHERE id = ?').get(id) as any;
      return row ? rowToEvolution(row) : null;
    },
    update: async (id: string, patch: Partial<EvolutionState>): Promise<void> => {
      const updates: string[] = ['updated_at = @updated_at'];
      const params: Record<string, any> = { id, updated_at: Date.now() };

      if (patch.currentGeneration !== undefined) {
        updates.push('current_generation = @current_generation');
        params.current_generation = patch.currentGeneration;
      }
      if (patch.status !== undefined) {
        updates.push('status = @status');
        params.status = patch.status;
      }
      if (patch.history !== undefined) {
        updates.push('history = @history');
        params.history = JSON.stringify(patch.history);
      }
      if (patch.designs !== undefined) {
        updates.push('designs = @designs');
        params.designs = JSON.stringify(patch.designs);
      }

      getDB().prepare(`UPDATE evolution_runs SET ${updates.join(', ')} WHERE id = @id`).run(params);
    },
  };

  demand = {
    save: async (result: DemandResult): Promise<void> => {
      getDB().prepare(`
        INSERT INTO demand_cache (demand_score, trend_vector, keyword_clusters, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(
        result.demandScore,
        JSON.stringify(result.trendVector),
        JSON.stringify(result.keywordClusters),
        result.timestamp,
      );
    },
    getLatest: async (): Promise<DemandResult | null> => {
      const row = getDB()
        .prepare('SELECT * FROM demand_cache ORDER BY timestamp DESC LIMIT 1')
        .get() as any;
      return row ? rowToDemand(row) : null;
    },
  };

  reinforcement = {
    save: async (decision: ReinforcementDecision): Promise<void> => {
      getDB().prepare(`
        INSERT OR REPLACE INTO reinforcement_events
          (id, design_id, total, axes, weights, gate, mutation_weight, lineage,
           demand_checksum, replay_checksum, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        decision.id,
        decision.designId,
        decision.total,
        JSON.stringify(decision.axes),
        JSON.stringify(decision.weights),
        JSON.stringify(decision.gate),
        decision.mutationWeight,
        JSON.stringify(decision.lineage),
        decision.demandChecksum,
        decision.replayChecksum,
        Date.now(),
      );
    },
    getLatest: async (limit = 20): Promise<ReinforcementDecision[]> => {
      const rows = getDB()
        .prepare('SELECT * FROM reinforcement_events ORDER BY created_at DESC LIMIT ?')
        .all(limit) as any[];
      return rows.map(rowToReinforcement);
    },
  };

  events = {
    append: async (event: EventLogInput): Promise<EventLogEntry> => {
      const createdAt = event.createdAt ?? Date.now();
      getDB().prepare(`
        INSERT INTO event_log
          (id, stream, type, sequence, payload, replay_checksum, created_at)
        VALUES
          (@id, @stream, @type, @sequence, @payload, @replay_checksum, @created_at)
      `).run({
        id: event.id,
        stream: event.stream,
        type: event.type,
        sequence: event.sequence,
        payload: JSON.stringify(event.payload),
        replay_checksum: event.replayChecksum,
        created_at: createdAt,
      });

      return { ...event, createdAt };
    },
    getByStream: async (stream: string, limit?: number): Promise<EventLogEntry[]> => {
      const params: Record<string, unknown> = { stream };
      const limitClause = limit ? 'LIMIT @limit' : '';
      if (limit) params.limit = limit;
      const rows = getDB()
        .prepare(`
          SELECT * FROM (
            SELECT * FROM event_log
            WHERE stream = @stream
            ORDER BY sequence DESC
            ${limitClause}
          )
          ORDER BY sequence ASC
        `)
        .all(params) as any[];
      return rows.map(rowToEvent);
    },
    getLatest: async (limit = 50): Promise<EventLogEntry[]> => {
      const rows = getDB()
        .prepare('SELECT * FROM event_log ORDER BY created_at DESC, sequence DESC LIMIT ?')
        .all(limit) as any[];
      return rows.map(rowToEvent);
    },
  };

  replayCheckpoints = {
    save: async (checkpoint: ReplayCheckpointInput): Promise<ReplayCheckpoint> => {
      const createdAt = checkpoint.createdAt ?? Date.now();
      getDB().prepare(`
        INSERT OR REPLACE INTO replay_checkpoints
          (id, stream, label, event_count, replay_checksum, state, created_at)
        VALUES
          (@id, @stream, @label, @event_count, @replay_checksum, @state, @created_at)
      `).run({
        id: checkpoint.id,
        stream: checkpoint.stream,
        label: checkpoint.label,
        event_count: checkpoint.eventCount,
        replay_checksum: checkpoint.replayChecksum,
        state: JSON.stringify(checkpoint.state),
        created_at: createdAt,
      });

      return { ...checkpoint, createdAt };
    },
    getLatest: async (stream?: string, limit = 20): Promise<ReplayCheckpoint[]> => {
      const rows = stream
        ? getDB()
          .prepare('SELECT * FROM replay_checkpoints WHERE stream = ? ORDER BY created_at DESC LIMIT ?')
          .all(stream, limit) as any[]
        : getDB()
          .prepare('SELECT * FROM replay_checkpoints ORDER BY created_at DESC LIMIT ?')
          .all(limit) as any[];
      return rows.map(rowToReplayCheckpoint);
    },
    getById: async (id: string): Promise<ReplayCheckpoint | null> => {
      const row = getDB().prepare('SELECT * FROM replay_checkpoints WHERE id = ?').get(id) as any;
      return row ? rowToReplayCheckpoint(row) : null;
    },
  };

  replayMonitorSnapshots = {
    save: async (snapshot: ReplayMonitorSnapshotInput): Promise<ReplayMonitorSnapshot> => {
      getDB().prepare(`
        INSERT OR REPLACE INTO replay_monitor_snapshots
          (id, stream, status, checked_at, event_count, checkpoint_count,
           latest_checkpoint_id, alert_count, alerts, report, acknowledged_at, acknowledged_by)
        VALUES
          (@id, @stream, @status, @checked_at, @event_count, @checkpoint_count,
           @latest_checkpoint_id, @alert_count, @alerts, @report, @acknowledged_at, @acknowledged_by)
      `).run({
        id: snapshot.id,
        stream: snapshot.stream,
        status: snapshot.status,
        checked_at: snapshot.checkedAt,
        event_count: snapshot.eventCount,
        checkpoint_count: snapshot.checkpointCount,
        latest_checkpoint_id: snapshot.latestCheckpointId ?? null,
        alert_count: snapshot.alertCount,
        alerts: JSON.stringify(snapshot.alerts),
        report: JSON.stringify(snapshot.report),
        acknowledged_at: snapshot.acknowledgedAt ?? null,
        acknowledged_by: snapshot.acknowledgedBy ?? null,
      });

      return {
        ...snapshot,
        acknowledgedAt: snapshot.acknowledgedAt,
        acknowledgedBy: snapshot.acknowledgedBy,
      };
    },
    getLatest: async (stream?: string, limit = 20): Promise<ReplayMonitorSnapshot[]> => {
      const rows = stream
        ? getDB()
          .prepare('SELECT * FROM replay_monitor_snapshots WHERE stream = ? ORDER BY checked_at DESC LIMIT ?')
          .all(stream, limit) as any[]
        : getDB()
          .prepare('SELECT * FROM replay_monitor_snapshots ORDER BY checked_at DESC LIMIT ?')
          .all(limit) as any[];
      return rows.map(rowToReplayMonitorSnapshot);
    },
    acknowledge: async (id: string, acknowledgedBy = 'operator'): Promise<ReplayMonitorSnapshot | null> => {
      const acknowledgedAt = Date.now();
      getDB()
        .prepare('UPDATE replay_monitor_snapshots SET acknowledged_at = ?, acknowledged_by = ? WHERE id = ?')
        .run(acknowledgedAt, acknowledgedBy, id);
      const row = getDB().prepare('SELECT * FROM replay_monitor_snapshots WHERE id = ?').get(id) as any;
      return row ? rowToReplayMonitorSnapshot(row) : null;
    },
  };

  releaseEvidence = {
    save: async (evidence: ReleaseEvidenceInput): Promise<ReleaseEvidenceRecord> => {
      const createdAt = evidence.createdAt ?? Date.now();
      getDB().prepare(`
        INSERT OR REPLACE INTO release_evidence
          (id, stream, provider, status, checked_at, gate_count, blocked_gate_count,
           degraded_gate_count, latest_monitor_snapshot_id, latest_alert_snapshot_id,
           rollback_status, latest_degraded_export_checksum, report, created_at)
        VALUES
          (@id, @stream, @provider, @status, @checked_at, @gate_count, @blocked_gate_count,
           @degraded_gate_count, @latest_monitor_snapshot_id, @latest_alert_snapshot_id,
           @rollback_status, @latest_degraded_export_checksum, @report, @created_at)
      `).run({
        id: evidence.id,
        stream: evidence.stream,
        provider: evidence.provider,
        status: evidence.status,
        checked_at: evidence.checkedAt,
        gate_count: evidence.gateCount,
        blocked_gate_count: evidence.blockedGateCount,
        degraded_gate_count: evidence.degradedGateCount,
        latest_monitor_snapshot_id: evidence.latestMonitorSnapshotId ?? null,
        latest_alert_snapshot_id: evidence.latestAlertSnapshotId ?? null,
        rollback_status: evidence.rollbackStatus,
        latest_degraded_export_checksum: evidence.latestDegradedExportChecksum ?? null,
        report: JSON.stringify(evidence.report),
        created_at: createdAt,
      });

      return { ...evidence, createdAt };
    },
    getLatest: async (
      stream?: string,
      limit = 20,
      filters: ReleaseEvidenceFilters = {},
    ): Promise<ReleaseEvidenceRecord[]> => {
      const conditions: string[] = [];
      const params: Record<string, unknown> = { limit };
      if (stream) {
        conditions.push('stream = @stream');
        params.stream = stream;
      }
      if (filters.provider) {
        conditions.push('provider = @provider');
        params.provider = filters.provider;
      }
      if (filters.status) {
        conditions.push('status = @status');
        params.status = filters.status;
      }
      if (filters.rollbackStatus) {
        conditions.push('rollback_status = @rollbackStatus');
        params.rollbackStatus = filters.rollbackStatus;
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = getDB()
        .prepare(`SELECT * FROM release_evidence ${where} ORDER BY checked_at DESC LIMIT @limit`)
        .all(params) as any[];
      return rows.map(rowToReleaseEvidence);
    },
    getById: async (id: string): Promise<ReleaseEvidenceRecord | null> => {
      const row = getDB().prepare('SELECT * FROM release_evidence WHERE id = ?').get(id) as any;
      return row ? rowToReleaseEvidence(row) : null;
    },
    deleteByIds: async (ids: string[]): Promise<number> => {
      if (!ids.length) return 0;
      const placeholders = ids.map(() => '?').join(', ');
      const result = getDB()
        .prepare(`DELETE FROM release_evidence WHERE id IN (${placeholders})`)
        .run(...ids);
      return Number(result.changes ?? 0);
    },
  };

  releaseDecisions = {
    save: async (decision: ReleaseDecisionInput): Promise<ReleaseDecisionRecord> => {
      const existing = getDB().prepare('SELECT id FROM release_decisions WHERE id = ?').get(decision.id);
      if (existing) {
        throw new Error(`Release decision already exists: ${decision.id}`);
      }
      const createdAt = decision.createdAt ?? Date.now();
      getDB().prepare(`
        INSERT INTO release_decisions
          (id, evidence_id, stream, provider, decision, reason, decided_by, decided_at,
           evidence_checksum, provider_signature, decision_signature, created_at)
        VALUES
          (@id, @evidence_id, @stream, @provider, @decision, @reason, @decided_by, @decided_at,
           @evidence_checksum, @provider_signature, @decision_signature, @created_at)
      `).run({
        id: decision.id,
        evidence_id: decision.evidenceId,
        stream: decision.stream,
        provider: decision.provider,
        decision: decision.decision,
        reason: decision.reason,
        decided_by: decision.decidedBy,
        decided_at: decision.decidedAt,
        evidence_checksum: decision.evidenceChecksum,
        provider_signature: decision.providerSignature,
        decision_signature: decision.decisionSignature,
        created_at: createdAt,
      });

      return { ...decision, createdAt };
    },
    getLatest: async (
      stream?: string,
      limit = 20,
      filters: ReleaseDecisionFilters = {},
    ): Promise<ReleaseDecisionRecord[]> => {
      const conditions: string[] = [];
      const params: Record<string, unknown> = { limit };
      if (stream) {
        conditions.push('stream = @stream');
        params.stream = stream;
      }
      if (filters.provider) {
        conditions.push('provider = @provider');
        params.provider = filters.provider;
      }
      if (filters.decision) {
        conditions.push('decision = @decision');
        params.decision = filters.decision;
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = getDB()
        .prepare(`SELECT * FROM release_decisions ${where} ORDER BY decided_at DESC LIMIT @limit`)
        .all(params) as any[];
      return rows.map(rowToReleaseDecision);
    },
    getById: async (id: string): Promise<ReleaseDecisionRecord | null> => {
      const row = getDB().prepare('SELECT * FROM release_decisions WHERE id = ?').get(id) as any;
      return row ? rowToReleaseDecision(row) : null;
    },
  };

  releaseReconciliations = {
    save: async (reconciliation: ReleaseReconciliationInput): Promise<ReleaseReconciliationRecord> => {
      const existing = getDB().prepare('SELECT id FROM release_reconciliations WHERE id = ?').get(reconciliation.id);
      if (existing) {
        throw new Error(`Release reconciliation already exists: ${reconciliation.id}`);
      }
      const createdAt = reconciliation.createdAt ?? Date.now();
      getDB().prepare(`
        INSERT INTO release_reconciliations
          (id, decision_id, evidence_id, stream, provider, commit_sha, branch,
           pull_request_url, source_thread, initiated_by, decision_signature,
           evidence_checksum, provider_signature, reconciliation_signature, created_at)
        VALUES
          (@id, @decision_id, @evidence_id, @stream, @provider, @commit_sha, @branch,
           @pull_request_url, @source_thread, @initiated_by, @decision_signature,
           @evidence_checksum, @provider_signature, @reconciliation_signature, @created_at)
      `).run({
        id: reconciliation.id,
        decision_id: reconciliation.decisionId,
        evidence_id: reconciliation.evidenceId,
        stream: reconciliation.stream,
        provider: reconciliation.provider,
        commit_sha: reconciliation.commitSha,
        branch: reconciliation.branch,
        pull_request_url: reconciliation.pullRequestUrl ?? null,
        source_thread: reconciliation.sourceThread ?? null,
        initiated_by: reconciliation.initiatedBy ?? null,
        decision_signature: reconciliation.decisionSignature,
        evidence_checksum: reconciliation.evidenceChecksum,
        provider_signature: reconciliation.providerSignature,
        reconciliation_signature: reconciliation.reconciliationSignature,
        created_at: createdAt,
      });

      return { ...reconciliation, createdAt };
    },
    getLatest: async (
      stream?: string,
      limit = 20,
      filters: ReleaseReconciliationFilters = {},
    ): Promise<ReleaseReconciliationRecord[]> => {
      const conditions: string[] = [];
      const params: Record<string, unknown> = { limit };
      if (stream) {
        conditions.push('stream = @stream');
        params.stream = stream;
      }
      if (filters.provider) {
        conditions.push('provider = @provider');
        params.provider = filters.provider;
      }
      if (filters.decisionId) {
        conditions.push('decision_id = @decisionId');
        params.decisionId = filters.decisionId;
      }
      if (filters.commitSha) {
        conditions.push('commit_sha = @commitSha');
        params.commitSha = filters.commitSha;
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = getDB()
        .prepare(`SELECT * FROM release_reconciliations ${where} ORDER BY created_at DESC LIMIT @limit`)
        .all(params) as any[];
      return rows.map(rowToReleaseReconciliation);
    },
    getById: async (id: string): Promise<ReleaseReconciliationRecord | null> => {
      const row = getDB().prepare('SELECT * FROM release_reconciliations WHERE id = ?').get(id) as any;
      return row ? rowToReleaseReconciliation(row) : null;
    },
  };

  async close(): Promise<void> {
    // SQLite connection ownership stays with db.ts for existing deterministic tests.
  }
}

export class PostgresStorageRepository implements StorageRepository {
  provider: DatabaseProvider = 'postgres';

  constructor(private readonly pool: Pool) {}

  designs = {
    create: async (design: DBDesign | Design): Promise<void> => {
      const row = designToRow(design);
      await this.pool.query(`
        INSERT INTO designs
          (id, seed, timestamp, input, mode, intent_vector, mechanics, content,
           score_total, score_demand, score_engagement, score_novelty, score_retention,
           generation, parent_ids, exported, archived)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          seed = EXCLUDED.seed,
          timestamp = EXCLUDED.timestamp,
          input = EXCLUDED.input,
          mode = EXCLUDED.mode,
          intent_vector = EXCLUDED.intent_vector,
          mechanics = EXCLUDED.mechanics,
          content = EXCLUDED.content,
          score_total = EXCLUDED.score_total,
          score_demand = EXCLUDED.score_demand,
          score_engagement = EXCLUDED.score_engagement,
          score_novelty = EXCLUDED.score_novelty,
          score_retention = EXCLUDED.score_retention,
          generation = EXCLUDED.generation,
          parent_ids = EXCLUDED.parent_ids,
          exported = EXCLUDED.exported,
          archived = EXCLUDED.archived
      `, [
        row.id,
        row.seed,
        row.timestamp,
        row.input,
        row.mode,
        row.intent_vector,
        row.mechanics,
        row.content,
        row.score_total,
        row.score_demand,
        row.score_engagement,
        row.score_novelty,
        row.score_retention,
        row.generation,
        row.parent_ids,
        Boolean(row.exported),
        Boolean(row.archived),
      ]);
    },
    getById: async (id: string): Promise<DBDesign | null> => {
      const result = await this.pool.query('SELECT * FROM designs WHERE id = $1', [id]);
      return result.rows[0] ? rowToDesign(result.rows[0]) : null;
    },
    getAll: async (opts: DesignQueryOptions = {}): Promise<DBDesign[]> => {
      const conditions = ['archived = FALSE'];
      const values: unknown[] = [];

      if (opts.minScore !== undefined) {
        values.push(opts.minScore);
        conditions.push(`score_total >= $${values.length}`);
      }
      if (opts.generation !== undefined) {
        values.push(opts.generation);
        conditions.push(`generation = $${values.length}`);
      }

      values.push(opts.limit ?? 50);
      const limitParam = values.length;
      values.push(opts.offset ?? 0);
      const offsetParam = values.length;

      const result = await this.pool.query(
        `SELECT * FROM designs WHERE ${conditions.join(' AND ')} ORDER BY score_total DESC LIMIT $${limitParam} OFFSET $${offsetParam}`,
        values,
      );
      return result.rows.map(rowToDesign);
    },
    getStats: async (): Promise<DesignStats> => {
      const result = await this.pool.query(
        'SELECT COUNT(*) as total, AVG(score_total) as "avgScore", MAX(score_total) as "topScore" FROM designs WHERE archived = FALSE',
      );
      const row = result.rows[0] ?? {};
      return {
        total: Number(row.total ?? 0),
        avgScore: Number(row.avgScore ?? 0),
        topScore: Number(row.topScore ?? 0),
      };
    },
    updateExported: async (id: string, exported: boolean): Promise<void> => {
      await this.pool.query('UPDATE designs SET exported = $1 WHERE id = $2', [exported, id]);
    },
  };

  evolutionRuns = {
    create: async (state: EvolutionState): Promise<void> => {
      const now = Date.now();
      await this.pool.query(`
        INSERT INTO evolution_runs
          (id, current_generation, max_generations, population_size, mutation_rate,
           elite_ratio, designs, history, status, config, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          current_generation = EXCLUDED.current_generation,
          designs = EXCLUDED.designs,
          history = EXCLUDED.history,
          status = EXCLUDED.status,
          config = EXCLUDED.config,
          updated_at = EXCLUDED.updated_at
      `, [
        state.runId,
        state.currentGeneration,
        state.maxGenerations,
        state.populationSize,
        state.mutationRate,
        state.eliteRatio,
        JSON.stringify(state.designs),
        JSON.stringify(state.history),
        state.status,
        JSON.stringify(state.config),
        now,
        now,
      ]);
    },
    getById: async (id: string): Promise<DBEvolutionRun | null> => {
      const result = await this.pool.query('SELECT * FROM evolution_runs WHERE id = $1', [id]);
      return result.rows[0] ? rowToEvolution(result.rows[0]) : null;
    },
    update: async (id: string, patch: Partial<EvolutionState>): Promise<void> => {
      const updates = ['updated_at = $1'];
      const values: unknown[] = [Date.now()];

      if (patch.currentGeneration !== undefined) {
        values.push(patch.currentGeneration);
        updates.push(`current_generation = $${values.length}`);
      }
      if (patch.status !== undefined) {
        values.push(patch.status);
        updates.push(`status = $${values.length}`);
      }
      if (patch.history !== undefined) {
        values.push(JSON.stringify(patch.history));
        updates.push(`history = $${values.length}`);
      }
      if (patch.designs !== undefined) {
        values.push(JSON.stringify(patch.designs));
        updates.push(`designs = $${values.length}`);
      }

      values.push(id);
      await this.pool.query(
        `UPDATE evolution_runs SET ${updates.join(', ')} WHERE id = $${values.length}`,
        values,
      );
    },
  };

  demand = {
    save: async (result: DemandResult): Promise<void> => {
      await this.pool.query(
        'INSERT INTO demand_cache (demand_score, trend_vector, keyword_clusters, timestamp) VALUES ($1, $2, $3, $4)',
        [
          result.demandScore,
          JSON.stringify(result.trendVector),
          JSON.stringify(result.keywordClusters),
          result.timestamp,
        ],
      );
    },
    getLatest: async (): Promise<DemandResult | null> => {
      const result = await this.pool.query('SELECT * FROM demand_cache ORDER BY timestamp DESC LIMIT 1');
      return result.rows[0] ? rowToDemand(result.rows[0]) : null;
    },
  };

  reinforcement = {
    save: async (decision: ReinforcementDecision): Promise<void> => {
      await this.pool.query(`
        INSERT INTO reinforcement_events
          (id, design_id, total, axes, weights, gate, mutation_weight, lineage,
           demand_checksum, replay_checksum, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          total = EXCLUDED.total,
          axes = EXCLUDED.axes,
          weights = EXCLUDED.weights,
          gate = EXCLUDED.gate,
          mutation_weight = EXCLUDED.mutation_weight,
          lineage = EXCLUDED.lineage,
          demand_checksum = EXCLUDED.demand_checksum,
          replay_checksum = EXCLUDED.replay_checksum,
          created_at = EXCLUDED.created_at
      `, [
        decision.id,
        decision.designId,
        decision.total,
        JSON.stringify(decision.axes),
        JSON.stringify(decision.weights),
        JSON.stringify(decision.gate),
        decision.mutationWeight,
        JSON.stringify(decision.lineage),
        decision.demandChecksum,
        decision.replayChecksum,
        Date.now(),
      ]);
    },
    getLatest: async (limit = 20): Promise<ReinforcementDecision[]> => {
      const result = await this.pool.query(
        'SELECT * FROM reinforcement_events ORDER BY created_at DESC LIMIT $1',
        [limit],
      );
      return result.rows.map(rowToReinforcement);
    },
  };

  events = {
    append: async (event: EventLogInput): Promise<EventLogEntry> => {
      const createdAt = event.createdAt ?? Date.now();
      await this.pool.query(`
        INSERT INTO event_log
          (id, stream, type, sequence, payload, replay_checksum, created_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7)
      `, [
        event.id,
        event.stream,
        event.type,
        event.sequence,
        JSON.stringify(event.payload),
        event.replayChecksum,
        createdAt,
      ]);

      return { ...event, createdAt };
    },
    getByStream: async (stream: string, limit?: number): Promise<EventLogEntry[]> => {
      const values: unknown[] = [stream];
      const limitClause = limit ? 'LIMIT $2' : '';
      if (limit) values.push(limit);
      const result = await this.pool.query(
        `
          SELECT * FROM (
            SELECT * FROM event_log
            WHERE stream = $1
            ORDER BY sequence DESC
            ${limitClause}
          ) recent_events
          ORDER BY sequence ASC
        `,
        values,
      );
      return result.rows.map(rowToEvent);
    },
    getLatest: async (limit = 50): Promise<EventLogEntry[]> => {
      const result = await this.pool.query(
        'SELECT * FROM event_log ORDER BY created_at DESC, sequence DESC LIMIT $1',
        [limit],
      );
      return result.rows.map(rowToEvent);
    },
  };

  replayCheckpoints = {
    save: async (checkpoint: ReplayCheckpointInput): Promise<ReplayCheckpoint> => {
      const createdAt = checkpoint.createdAt ?? Date.now();
      await this.pool.query(`
        INSERT INTO replay_checkpoints
          (id, stream, label, event_count, replay_checksum, state, created_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          stream = EXCLUDED.stream,
          label = EXCLUDED.label,
          event_count = EXCLUDED.event_count,
          replay_checksum = EXCLUDED.replay_checksum,
          state = EXCLUDED.state,
          created_at = EXCLUDED.created_at
      `, [
        checkpoint.id,
        checkpoint.stream,
        checkpoint.label,
        checkpoint.eventCount,
        checkpoint.replayChecksum,
        JSON.stringify(checkpoint.state),
        createdAt,
      ]);

      return { ...checkpoint, createdAt };
    },
    getLatest: async (stream?: string, limit = 20): Promise<ReplayCheckpoint[]> => {
      const result = stream
        ? await this.pool.query(
          'SELECT * FROM replay_checkpoints WHERE stream = $1 ORDER BY created_at DESC LIMIT $2',
          [stream, limit],
        )
        : await this.pool.query(
          'SELECT * FROM replay_checkpoints ORDER BY created_at DESC LIMIT $1',
          [limit],
        );
      return result.rows.map(rowToReplayCheckpoint);
    },
    getById: async (id: string): Promise<ReplayCheckpoint | null> => {
      const result = await this.pool.query('SELECT * FROM replay_checkpoints WHERE id = $1', [id]);
      return result.rows[0] ? rowToReplayCheckpoint(result.rows[0]) : null;
    },
  };

  replayMonitorSnapshots = {
    save: async (snapshot: ReplayMonitorSnapshotInput): Promise<ReplayMonitorSnapshot> => {
      await this.pool.query(`
        INSERT INTO replay_monitor_snapshots
          (id, stream, status, checked_at, event_count, checkpoint_count,
           latest_checkpoint_id, alert_count, alerts, report, acknowledged_at, acknowledged_by)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          stream = EXCLUDED.stream,
          status = EXCLUDED.status,
          checked_at = EXCLUDED.checked_at,
          event_count = EXCLUDED.event_count,
          checkpoint_count = EXCLUDED.checkpoint_count,
          latest_checkpoint_id = EXCLUDED.latest_checkpoint_id,
          alert_count = EXCLUDED.alert_count,
          alerts = EXCLUDED.alerts,
          report = EXCLUDED.report,
          acknowledged_at = EXCLUDED.acknowledged_at,
          acknowledged_by = EXCLUDED.acknowledged_by
      `, [
        snapshot.id,
        snapshot.stream,
        snapshot.status,
        snapshot.checkedAt,
        snapshot.eventCount,
        snapshot.checkpointCount,
        snapshot.latestCheckpointId ?? null,
        snapshot.alertCount,
        JSON.stringify(snapshot.alerts),
        JSON.stringify(snapshot.report),
        snapshot.acknowledgedAt ?? null,
        snapshot.acknowledgedBy ?? null,
      ]);

      return {
        ...snapshot,
        acknowledgedAt: snapshot.acknowledgedAt,
        acknowledgedBy: snapshot.acknowledgedBy,
      };
    },
    getLatest: async (stream?: string, limit = 20): Promise<ReplayMonitorSnapshot[]> => {
      const result = stream
        ? await this.pool.query(
          'SELECT * FROM replay_monitor_snapshots WHERE stream = $1 ORDER BY checked_at DESC LIMIT $2',
          [stream, limit],
        )
        : await this.pool.query(
          'SELECT * FROM replay_monitor_snapshots ORDER BY checked_at DESC LIMIT $1',
          [limit],
        );
      return result.rows.map(rowToReplayMonitorSnapshot);
    },
    acknowledge: async (id: string, acknowledgedBy = 'operator'): Promise<ReplayMonitorSnapshot | null> => {
      const acknowledgedAt = Date.now();
      const result = await this.pool.query(`
        UPDATE replay_monitor_snapshots
        SET acknowledged_at = $1, acknowledged_by = $2
        WHERE id = $3
        RETURNING *
      `, [acknowledgedAt, acknowledgedBy, id]);
      return result.rows[0] ? rowToReplayMonitorSnapshot(result.rows[0]) : null;
    },
  };

  releaseEvidence = {
    save: async (evidence: ReleaseEvidenceInput): Promise<ReleaseEvidenceRecord> => {
      const createdAt = evidence.createdAt ?? Date.now();
      await this.pool.query(`
        INSERT INTO release_evidence
          (id, stream, provider, status, checked_at, gate_count, blocked_gate_count,
           degraded_gate_count, latest_monitor_snapshot_id, latest_alert_snapshot_id,
           rollback_status, latest_degraded_export_checksum, report, created_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          stream = EXCLUDED.stream,
          provider = EXCLUDED.provider,
          status = EXCLUDED.status,
          checked_at = EXCLUDED.checked_at,
          gate_count = EXCLUDED.gate_count,
          blocked_gate_count = EXCLUDED.blocked_gate_count,
          degraded_gate_count = EXCLUDED.degraded_gate_count,
          latest_monitor_snapshot_id = EXCLUDED.latest_monitor_snapshot_id,
          latest_alert_snapshot_id = EXCLUDED.latest_alert_snapshot_id,
          rollback_status = EXCLUDED.rollback_status,
          latest_degraded_export_checksum = EXCLUDED.latest_degraded_export_checksum,
          report = EXCLUDED.report,
          created_at = EXCLUDED.created_at
      `, [
        evidence.id,
        evidence.stream,
        evidence.provider,
        evidence.status,
        evidence.checkedAt,
        evidence.gateCount,
        evidence.blockedGateCount,
        evidence.degradedGateCount,
        evidence.latestMonitorSnapshotId ?? null,
        evidence.latestAlertSnapshotId ?? null,
        evidence.rollbackStatus,
        evidence.latestDegradedExportChecksum ?? null,
        JSON.stringify(evidence.report),
        createdAt,
      ]);

      return { ...evidence, createdAt };
    },
    getLatest: async (
      stream?: string,
      limit = 20,
      filters: ReleaseEvidenceFilters = {},
    ): Promise<ReleaseEvidenceRecord[]> => {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (stream) {
        values.push(stream);
        conditions.push(`stream = $${values.length}`);
      }
      if (filters.provider) {
        values.push(filters.provider);
        conditions.push(`provider = $${values.length}`);
      }
      if (filters.status) {
        values.push(filters.status);
        conditions.push(`status = $${values.length}`);
      }
      if (filters.rollbackStatus) {
        values.push(filters.rollbackStatus);
        conditions.push(`rollback_status = $${values.length}`);
      }
      values.push(limit);
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await this.pool.query(
        `SELECT * FROM release_evidence ${where} ORDER BY checked_at DESC LIMIT $${values.length}`,
        values,
      );
      return result.rows.map(rowToReleaseEvidence);
    },
    getById: async (id: string): Promise<ReleaseEvidenceRecord | null> => {
      const result = await this.pool.query('SELECT * FROM release_evidence WHERE id = $1', [id]);
      return result.rows[0] ? rowToReleaseEvidence(result.rows[0]) : null;
    },
    deleteByIds: async (ids: string[]): Promise<number> => {
      if (!ids.length) return 0;
      const result = await this.pool.query('DELETE FROM release_evidence WHERE id = ANY($1::text[])', [ids]);
      return Number(result.rowCount ?? 0);
    },
  };

  releaseDecisions = {
    save: async (decision: ReleaseDecisionInput): Promise<ReleaseDecisionRecord> => {
      const existing = await this.pool.query('SELECT id FROM release_decisions WHERE id = $1', [decision.id]);
      if (existing.rows[0]) {
        throw new Error(`Release decision already exists: ${decision.id}`);
      }
      const createdAt = decision.createdAt ?? Date.now();
      await this.pool.query(`
        INSERT INTO release_decisions
          (id, evidence_id, stream, provider, decision, reason, decided_by, decided_at,
           evidence_checksum, provider_signature, decision_signature, created_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        decision.id,
        decision.evidenceId,
        decision.stream,
        decision.provider,
        decision.decision,
        decision.reason,
        decision.decidedBy,
        decision.decidedAt,
        decision.evidenceChecksum,
        decision.providerSignature,
        decision.decisionSignature,
        createdAt,
      ]);

      return { ...decision, createdAt };
    },
    getLatest: async (
      stream?: string,
      limit = 20,
      filters: ReleaseDecisionFilters = {},
    ): Promise<ReleaseDecisionRecord[]> => {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (stream) {
        values.push(stream);
        conditions.push(`stream = $${values.length}`);
      }
      if (filters.provider) {
        values.push(filters.provider);
        conditions.push(`provider = $${values.length}`);
      }
      if (filters.decision) {
        values.push(filters.decision);
        conditions.push(`decision = $${values.length}`);
      }
      values.push(limit);
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await this.pool.query(
        `SELECT * FROM release_decisions ${where} ORDER BY decided_at DESC LIMIT $${values.length}`,
        values,
      );
      return result.rows.map(rowToReleaseDecision);
    },
    getById: async (id: string): Promise<ReleaseDecisionRecord | null> => {
      const result = await this.pool.query('SELECT * FROM release_decisions WHERE id = $1', [id]);
      return result.rows[0] ? rowToReleaseDecision(result.rows[0]) : null;
    },
  };

  releaseReconciliations = {
    save: async (reconciliation: ReleaseReconciliationInput): Promise<ReleaseReconciliationRecord> => {
      const existing = await this.pool.query('SELECT id FROM release_reconciliations WHERE id = $1', [reconciliation.id]);
      if (existing.rows[0]) {
        throw new Error(`Release reconciliation already exists: ${reconciliation.id}`);
      }
      const createdAt = reconciliation.createdAt ?? Date.now();
      await this.pool.query(`
        INSERT INTO release_reconciliations
          (id, decision_id, evidence_id, stream, provider, commit_sha, branch,
           pull_request_url, source_thread, initiated_by, decision_signature,
           evidence_checksum, provider_signature, reconciliation_signature, created_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        reconciliation.id,
        reconciliation.decisionId,
        reconciliation.evidenceId,
        reconciliation.stream,
        reconciliation.provider,
        reconciliation.commitSha,
        reconciliation.branch,
        reconciliation.pullRequestUrl ?? null,
        reconciliation.sourceThread ?? null,
        reconciliation.initiatedBy ?? null,
        reconciliation.decisionSignature,
        reconciliation.evidenceChecksum,
        reconciliation.providerSignature,
        reconciliation.reconciliationSignature,
        createdAt,
      ]);

      return { ...reconciliation, createdAt };
    },
    getLatest: async (
      stream?: string,
      limit = 20,
      filters: ReleaseReconciliationFilters = {},
    ): Promise<ReleaseReconciliationRecord[]> => {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (stream) {
        values.push(stream);
        conditions.push(`stream = $${values.length}`);
      }
      if (filters.provider) {
        values.push(filters.provider);
        conditions.push(`provider = $${values.length}`);
      }
      if (filters.decisionId) {
        values.push(filters.decisionId);
        conditions.push(`decision_id = $${values.length}`);
      }
      if (filters.commitSha) {
        values.push(filters.commitSha);
        conditions.push(`commit_sha = $${values.length}`);
      }
      values.push(limit);
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await this.pool.query(
        `SELECT * FROM release_reconciliations ${where} ORDER BY created_at DESC LIMIT $${values.length}`,
        values,
      );
      return result.rows.map(rowToReleaseReconciliation);
    },
    getById: async (id: string): Promise<ReleaseReconciliationRecord | null> => {
      const result = await this.pool.query('SELECT * FROM release_reconciliations WHERE id = $1', [id]);
      return result.rows[0] ? rowToReleaseReconciliation(result.rows[0]) : null;
    },
  };

  async close(): Promise<void> {
    await this.pool.end();
  }
}

let activeRepository: StorageRepository = new SqliteStorageRepository();

export function getStorageRepository(): StorageRepository {
  return activeRepository;
}

export async function initializeStorageRepository(
  config: DatabaseRuntimeConfig = resolveDatabaseRuntimeConfig(),
): Promise<StorageRepository> {
  if (config.provider === 'postgres') {
    if (!config.postgresUrl) {
      throw new Error('DATABASE_URL is required when DATABASE_PROVIDER=postgres');
    }
    if (config.migrationsEnabled) {
      await runPostgresMigrations(config.postgresUrl);
    }
    const pool = new Pool({ connectionString: config.postgresUrl });
    await pool.query('SELECT 1');
    activeRepository = new PostgresStorageRepository(pool);
    return activeRepository;
  }

  initDatabase(config.sqlitePath);
  activeRepository = new SqliteStorageRepository();
  return activeRepository;
}
