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
const rollbackId = args.get('rollback-id') || process.env.AGROS_RELEASE_ROLLBACK_ID || '';
const output = args.get('output') || process.env.AGROS_RELEASE_ROLLBACK_TIMELINE_PATH || 'outputs/release-rollback-timeline.json';

async function requestJson(route) {
  const response = await fetch(`${apiUrl}${route}`);
  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.error || `request failed with HTTP ${response.status}`);
  }
  return payload;
}

try {
  if (!rollbackId) {
    throw new Error('rollback id is required; pass --rollback-id or AGROS_RELEASE_ROLLBACK_ID');
  }

  const payload = await requestJson(`/release/rollbacks/${encodeURIComponent(rollbackId)}/timeline`);
  const absoluteOutput = path.resolve(output);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  fs.writeFileSync(absoluteOutput, `${JSON.stringify(payload.timeline, null, 2)}\n`);
  console.log(JSON.stringify({
    output: absoluteOutput,
    rollbackId,
    status: payload.timeline.rollback.status,
    timelineEvents: payload.timeline.timeline.length,
    ciChecks: payload.timeline.ciChecks.length,
    exportChecksum: payload.timeline.exportChecksum,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    rollbackId,
    status: 'blocked',
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
}
