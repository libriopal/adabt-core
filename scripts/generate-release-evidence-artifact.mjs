#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const args = new Map(
  process.argv.slice(2).map(arg => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.join('=') || 'true'];
  }),
);

const apiUrl = (args.get('api-url') || process.env.AGROS_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const provider = args.get('provider') || process.env.AGROS_RELEASE_PROVIDER || 'local-docker';
const stream = args.get('stream') || process.env.AGROS_REPLAY_STREAM || 'agros-replay-suite';
const output = args.get('output') || process.env.AGROS_RELEASE_ARTIFACT_PATH || `outputs/release-evidence-${provider}.json`;

async function requestJson(route) {
  const response = await fetch(`${apiUrl}${route}`);
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
    includeRollbackPreflight: 'true',
  });
  const payload = await requestJson(`/release/evidence/export?${query.toString()}`);
  const absoluteOutput = path.resolve(output);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  fs.writeFileSync(absoluteOutput, `${JSON.stringify(payload.export, null, 2)}\n`);
  console.log(JSON.stringify({
    output: absoluteOutput,
    provider,
    stream,
    status: payload.export.release.status,
    exportChecksum: payload.export.exportChecksum,
    rollbackChecksum: payload.export.degradedReplayExport?.exportChecksum ?? null,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    provider,
    stream,
    status: 'blocked',
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
}
