// simulateEconomy.ts — Thin wrapper over Sacred Core Monte Carlo + RTP config.
// Governance: all post_bank-hook genre modules are payout-neutral until this
// script confirms < 2% RTP deviance per mode (unified_lattice.json r1, Q3/b).
//
// Usage: npx tsx scripts/simulateEconomy.ts
// Requires: packages/farkle-engine built or accessible via ts-node / tsx.

import { runMonteCarlo } from '../packages/farkle-engine/src/monteCarlo.js';
import { RTP_CONFIGS } from '../packages/farkle-engine/src/rtpConfig.js';
import type { GameMode } from '../packages/farkle-shared/src/types.js';

const SESSIONS = 10_000;
const DEVIANCE_GATE = 0.02; // 2% tolerance per organic-vegas-sot-r1

const modes = Object.keys(RTP_CONFIGS) as GameMode[];

console.log(`\n═══ ORGANIC VEGAS — Economy Simulation ═══`);
console.log(`Sessions per mode: ${SESSIONS.toLocaleString()}`);
console.log(`RTP deviance gate: ${(DEVIANCE_GATE * 100).toFixed(0)}%\n`);

let allPassed = true;

for (const mode of modes) {
  const cfg = RTP_CONFIGS[mode];
  const result = runMonteCarlo(mode, SESSIONS);
  const observed = result.averageScore / result.normalizer;
  const deviance = Math.abs(observed - cfg.targetRTP) / cfg.targetRTP;
  const pass = deviance <= DEVIANCE_GATE;
  if (!pass) allPassed = false;

  console.log(
    `${pass ? '✓' : '✗'} ${mode.padEnd(16)}` +
    ` targetRTP=${cfg.targetRTP.toFixed(2)}` +
    ` avgScore=${result.averageScore.toFixed(0).padStart(8)}` +
    ` farkleRate=${(result.farkleRate * 100).toFixed(1)}%` +
    ` deviance=${(deviance * 100).toFixed(2)}%` +
    (pass ? '' : '  ← GATE FAIL')
  );
}

console.log('\n' + (allPassed
  ? '✓ All modes within 2% RTP gate. Post_bank genre modules cleared for review.'
  : '✗ One or more modes failed the RTP gate. Post_bank genre payout activation BLOCKED.'));

process.exit(allPassed ? 0 : 1);
