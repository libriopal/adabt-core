interface ChainDecisionRecord {
  id: string;
  session_id: string;
  player_id: string;
  chain_number: number;
  faces_played: number[];
  score_result: number;
  multiplier_at: number;
  unbanked_before: number;
  decision: string;
  was_optimal: boolean;
  timestamp: string;
}

interface SessionRecord {
  id: string;
  player_id: string;
  mode: string;
  seed_hash: string;
  started_at: string;
  ended_at: string;
  total_chains: number;
  scoring_chains: number;
  farkle_count: number;
  banks_taken: number;
  peak_multiplier: number;
  final_banked: number;
  final_score: number;
  avg_chain_score: number;
}

const chainDecisionBuffer: ChainDecisionRecord[] = [];
const sessionBuffer: SessionRecord[] = [];

export function insertChainDecision(record: ChainDecisionRecord): void {
  chainDecisionBuffer.push(record);
}

export function insertSession(record: SessionRecord): void {
  sessionBuffer.push(record);
}

export function getAnalyticsSnapshot(): {
  chainDecisions: ChainDecisionRecord[];
  sessions: SessionRecord[];
} {
  return {
    chainDecisions: [...chainDecisionBuffer],
    sessions: [...sessionBuffer],
  };
}
