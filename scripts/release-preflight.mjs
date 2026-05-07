#!/usr/bin/env node

const args = new Map(
  process.argv.slice(2).map(arg => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.join('=') || 'true'];
  }),
);

const provider = args.get('provider') || process.env.AGROS_RELEASE_PROVIDER || 'local-docker';
const stream = args.get('stream') || process.env.AGROS_REPLAY_STREAM || 'agros-replay-suite';
const apiUrl = (args.get('api-url') || process.env.AGROS_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const rollbackCheck = ['true', '1', 'yes'].includes(String(args.get('rollback-check') || process.env.AGROS_ROLLBACK_PREFLIGHT || 'false').toLowerCase());

async function requestJson(path) {
  const response = await fetch(`${apiUrl}${path}`);
  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.error || `request failed with HTTP ${response.status}`);
  }
  return payload;
}

try {
  const query = new URLSearchParams({
    stream,
    provider,
    persistMonitor: 'false',
    includeRollbackPreflight: rollbackCheck ? 'true' : 'false',
  });
  const { release } = await requestJson(`/release/readiness?${query.toString()}`);
  const summary = {
    provider,
    apiUrl,
    stream,
    status: release.status,
    rollbackPreflight: release.rollbackPreflight,
    gates: release.gates.map(gate => ({
      name: gate.name,
      status: gate.status,
      detail: gate.detail,
    })),
    recommendations: release.recommendations,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (release.status !== 'ready' || release.rollbackPreflight.status === 'blocked') {
    process.exit(1);
  }
} catch (error) {
  console.error(JSON.stringify({
    provider,
    apiUrl,
    stream,
    status: 'blocked',
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
}
