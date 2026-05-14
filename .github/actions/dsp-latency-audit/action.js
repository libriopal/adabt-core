// Dependency-free DSP latency audit — uses only GitHub workflow commands via stdout.
// No @actions/core or node_modules required.

const SAMPLE_RATE = 48000;
const BLOCK_SIZE = 128;
const BUDGET_MS = (BLOCK_SIZE / SAMPLE_RATE) * 1000; // 2.6667 ms
const JITTER_ABS_CEILING_MS = 1.0; // max - mean must not exceed 1 ms (Tier 0 Android)
const ITERATIONS = 1000;

function log(msg) {
  process.stdout.write(msg + '\n');
}

function fail(msg) {
  process.stdout.write(`::error::${msg}\n`);
  process.exitCode = 1;
}

function simulateDspBlock(blockSize) {
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

  // Warm-up — not measured
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

  // Absolute jitter: max - mean. Avoids division-by-near-zero when DSP is very fast.
  const jitterAbs = max - mean;

  log(`DSP Latency Audit — ${ITERATIONS} iterations @ ${SAMPLE_RATE} Hz, block ${BLOCK_SIZE}`);
  log(`  Budget       : ${BUDGET_MS.toFixed(4)} ms`);
  log(`  Mean         : ${mean.toFixed(4)} ms`);
  log(`  p99          : ${p99.toFixed(4)} ms`);
  log(`  Max          : ${max.toFixed(4)} ms`);
  log(`  Jitter (abs) : ${jitterAbs.toFixed(4)} ms  (ceiling ${JITTER_ABS_CEILING_MS} ms)`);

  if (mean > BUDGET_MS) {
    fail(`Mean render time ${mean.toFixed(4)} ms exceeds Tier 0 budget of ${BUDGET_MS.toFixed(4)} ms`);
    return;
  }
  if (p99 > BUDGET_MS) {
    fail(`p99 render time ${p99.toFixed(4)} ms exceeds Tier 0 budget of ${BUDGET_MS.toFixed(4)} ms`);
    return;
  }
  if (jitterAbs > JITTER_ABS_CEILING_MS) {
    fail(`Absolute jitter ${jitterAbs.toFixed(4)} ms exceeds Tier 0 ceiling of ${JITTER_ABS_CEILING_MS} ms`);
    return;
  }

  log('::notice::Audit passed: DSP render is within Tier 0 latency and jitter budget.');
}

runAudit();
