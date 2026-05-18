import { buildScoreTable, lookupScore, encode } from '../packages/farkle-engine/src/chainIndex.js';
import { seededRng } from '../packages/farkle-engine/src/csprng.js';
import type { DieFace } from '../packages/farkle-shared/src/types.js';

const table = buildScoreTable();
console.log('Table built, size:', table.length, 'non-zero:', Array.from(table).filter(v => v > 0).length);

const known: [DieFace[], number][] = [
  [[1,1,1,2,3,4], 1000],
  [[1,2,3,4,5,6], 1500],
  [[5,2,3,4,6,1], 1500],
  [[1,2,3,4,6,3], 100],
  [[5,2,6,4,6,2], 50],
  [[1,1,1,1,1,1], 3000],
];

for (const [roll, expected] of known) {
  const idx = encode(roll);
  const score = lookupScore(roll, table);
  console.log(`roll=[${roll}] index=${idx} score=${score} expected=${expected} ${score===expected?'✓':'✗'}`);
}

const rng = seededRng(42);
const sample = Array.from({length:6}, () => (Math.floor(rng() * 6) + 1) as DieFace);
console.log('Sample roll seededRng(42):', sample, '→', lookupScore(sample, table));

let farkles = 0;
for (let i = 0; i < 20; i++) {
  const r = seededRng(i);
  const roll = Array.from({length:6}, () => (Math.floor(r() * 6) + 1) as DieFace);
  const s = lookupScore(roll, table);
  if (s === 0) farkles++;
  console.log(`s${i}: [${roll}] → ${s}`);
}
console.log(`Observed farkle rate: ${farkles}/20`);
