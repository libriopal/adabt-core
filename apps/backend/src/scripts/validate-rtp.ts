/**
 * Monte Carlo RTP Validation — ECON_STABILITY gate
 *
 * Runs two independent half-runs of 5,000 sessions per GameMode and checks
 * that the normalizer (calibration factor) is stable to within 2% between
 * halves. A stable normalizer means the payout scaling is reproducible.
 *
 * The normalizer = averageScore / targetRTP is a raw-score calibration factor
 * (expected magnitude ~90–100x for standard modes). Stability is measured as
 * |half2 - half1| / half1.
 *
 * Output: data/rtp-validation.json
 * Usage:  npx tsx src/scripts/validate-rtp.ts
 */

import fs from 'fs';
import path from 'path';
import { runMonteCarlo } from '@match3d/farkle-engine';
import { RTP_CONFIGS } from '@match3d/farkle-engine';

type GameMode = 'SOLO_FREE' | 'SOLO_CASINO' | 'VS_FREE' | 'VS_CASINO'
  | 'RALLY_FREE' | 'RALLY_CASINO' | 'HEIST_FREE' | 'HEIST_CASINO';

const HALF = 5_000;
const SESSIONS = HALF * 2;
const STABILITY_THRESHOLD = 0.02;

const MODES: GameMode[] = [
  'SOLO_FREE', 'SOLO_CASINO',
  'VS_FREE', 'VS_CASINO',
  'RALLY_FREE', 'RALLY_CASINO',
  'HEIST_FREE', 'HEIST_CASINO',
];

interface ModeResult {
  mode: GameMode;
  targetRTP: number;
  normalizer_h1: number;
  normalizer_h2: number;
  stabDeviance: number;
  averageScore_h1: number;
  averageScore_h2: number;
  farkleRate: number;
  sessionsRun: number;
  pass: boolean;
}

console.log(`\nFarkle Frenzy — Monte Carlo RTP Stability Validation`);
console.log(`Sessions per mode: ${SESSIONS.toLocaleString()} (2 × ${HALF.toLocaleString()} halves)`);
console.log(`Stability threshold: ${(STABILITY_THRESHOLD * 100).toFixed(1)}%\n`);

const results: ModeResult[] = [];
let allPass = true;

for (const mode of MODES) {
  process.stdout.write(`  ${mode.padEnd(16)} ... `);
  const start = Date.now();

  const h1 = runMonteCarlo(mode, HALF);
  const h2 = runMonteCarlo(mode, HALF);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const stabDeviance = Math.abs(h2.normalizer - h1.normalizer) / h1.normalizer;
  const pass = stabDeviance < STABILITY_THRESHOLD;
  if (!pass) allPass = false;

  const status = pass ? 'PASS' : 'FAIL';
  console.log(
    `${status}  stability=${(stabDeviance * 100).toFixed(3)}%` +
    `  norm=[${h1.normalizer.toFixed(2)}, ${h2.normalizer.toFixed(2)}]` +
    `  farkle=${(h1.farkleRate * 100).toFixed(1)}%  (${elapsed}s)`
  );

  results.push({
    mode,
    targetRTP: RTP_CONFIGS[mode].targetRTP,
    normalizer_h1: parseFloat(h1.normalizer.toFixed(4)),
    normalizer_h2: parseFloat(h2.normalizer.toFixed(4)),
    stabDeviance: parseFloat(stabDeviance.toFixed(6)),
    averageScore_h1: Math.round(h1.averageScore),
    averageScore_h2: Math.round(h2.averageScore),
    farkleRate: parseFloat(h1.farkleRate.toFixed(4)),
    sessionsRun: SESSIONS,
    pass,
  });
}

const output = {
  generatedAt: new Date().toISOString(),
  sessions: SESSIONS,
  stabilityThreshold: STABILITY_THRESHOLD,
  overallPass: allPass,
  results,
};

const outPath = path.join(process.cwd(), 'data', 'rtp-validation.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`\nOverall: ${allPass ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Written: ${outPath}\n`);

if (!allPass) process.exit(1);
