import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { LeaderboardDB } from '../storage/db';

export const leaderboardRouter = Router();

const VALID_MODES = ['SOLO_FREE', 'SOLO_CASINO', 'VS_FREE', 'VS_CASINO',
  'RALLY_FREE', 'RALLY_CASINO', 'HEIST_FREE', 'HEIST_CASINO'] as const;

const SubmitSchema = z.object({
  playerId: z.string().min(1).max(64),
  displayName: z.string().min(1).max(32),
  mode: z.enum(VALID_MODES),
  score: z.number().int().min(0).max(10_000_000),
  sessionSeed: z.string().min(1).max(128),
  gameDurationMs: z.number().int().min(0).default(0),
});

// GET /api/leaderboard/:mode — top scores for a game mode
leaderboardRouter.get('/:mode', (req, res) => {
  const mode = req.params.mode?.toUpperCase();
  if (!VALID_MODES.includes(mode as any)) {
    return res.status(400).json({ success: false, error: `Invalid mode. Valid: ${VALID_MODES.join(', ')}` });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  const entries = LeaderboardDB.getTopByMode(mode as any, limit, offset);
  res.json({ success: true, mode, entries, count: entries.length, limit, offset });
});

// POST /api/leaderboard/submit — submit a score
leaderboardRouter.post('/submit', (req, res) => {
  try {
    const body = SubmitSchema.parse(req.body);

    const id = nanoid();
    LeaderboardDB.submit({
      id,
      playerId: body.playerId,
      displayName: body.displayName,
      mode: body.mode,
      score: body.score,
      sessionSeed: body.sessionSeed,
      gameDurationMs: body.gameDurationMs,
      verified: false,
    });

    const rank = LeaderboardDB.getRankForScore(body.mode, body.score);
    res.json({ success: true, id, rank });
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /api/leaderboard/player/:playerId — best score per mode for a player
leaderboardRouter.get('/player/:playerId', (req, res) => {
  const entries = LeaderboardDB.getPlayerBest(req.params.playerId);
  res.json({ success: true, playerId: req.params.playerId, entries });
});
