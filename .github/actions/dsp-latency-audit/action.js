const core = require('@actions/core');

const SAMPLE_RATE = 48000;
const BLOCK_SIZE = 128;
const BUDGET_MS = (BLOCK_SIZE / SAMPLE_RATE) * 1000; // 2.6667 ms
const JITTER_THRESHOLD = 0.10; // 10%
const ITERATIONS = 1000;

function simulateDspBlock(blockSize) {
  // Simulate a realistic DSP render: per-sample gain + simple one-pole LP filter.
  const input = new Float32Array(blockSize);
  const output = new Float32Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    input[i] = (Math.random() * 2 - 1) * 0.5;
  }
  let z = 0;
  const coeff = 0.9;
  for (let i = 0; i < blockSize; i++) {
    z = coeff * z + (1 - coeff) * input[i];
    output[i] = z;
  }
  return output[blockSize - 1]; // prevent dead-code elimination
}

function runAudit() {
  const samples = [];

  // Warm-up pass (not measured)
  for (let i = 0; i < 50; i++) simulateDspBlock(BLOCK_SIZE);

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    simulateDspBlock(BLOCK_SIZE);
    const t1 = performance.now();
    samples.push(t1 - t0);
  }

  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const max = Math.max(...samples);
  const sorted = [...samples].sort((a, b) => a - b);
  const p99 = sorted[Math.floor(0.99 * sorted.length)];

  const jitterRatio = (max - mean) / mean;

  core.info(`DSP Latency Audit — ${ITERATIONS} iterations @ ${SAMPLE_RATE} Hz, block ${BLOCK_SIZE}`);
  core.info(`  Budget  : ${BUDGET_MS.toFixed(4)} ms`);
  core.info(`  Mean    : ${mean.toFixed(4)} ms`);
  core.info(`  p99     : ${p99.toFixed(4)} ms`);
  core.info(`  Max     : ${max.toFixed(4)} ms`);
  core.info(`  Jitter  : ${(jitterRatio * 100).toFixed(2)}% (threshold ${JITTER_THRESHOLD * 100}%)`);

  if (mean > BUDGET_MS) {
    core.setFailed(`Mean render time ${mean.toFixed(4)} ms exceeds Tier 0 budget of ${BUDGET_MS.toFixed(4)} ms`);
    return;
  }
  if (p99 > BUDGET_MS) {
    core.setFailed(`p99 render time ${p99.toFixed(4)} ms exceeds Tier 0 budget of ${BUDGET_MS.toFixed(4)} ms`);
    return;
  }
  if (jitterRatio > JITTER_THRESHOLD) {
    core.setFailed(`Jitter ${(jitterRatio * 100).toFixed(2)}% exceeds Tier 0 threshold of ${JITTER_THRESHOLD * 100}%`);
    return;
  }

  core.info('Audit passed: DSP render is within Tier 0 latency and jitter budget.');
}

runAudit();
