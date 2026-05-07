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
const decisionId = args.get('decision-id') || process.env.AGROS_RELEASE_DECISION_ID || '';
const promotionId = args.get('promotion-id') || process.env.AGROS_RELEASE_PROMOTION_ID || '';
const rollbackId = args.get('rollback-id') || process.env.AGROS_RELEASE_ROLLBACK_ID || '';
const provider = args.get('provider') || process.env.AGROS_RELEASE_PROVIDER || '';
const stream = args.get('stream') || process.env.AGROS_REPLAY_STREAM || 'agros-replay-suite';
const owner = args.get('owner') || process.env.AGROS_RELEASE_INCIDENT_OWNER || 'release-owner';
const visibility = args.get('visibility') || process.env.AGROS_RELEASE_PACKET_VISIBILITY || 'private';
const output = args.get('output') || process.env.AGROS_RELEASE_INCIDENT_PACKET_PATH || 'outputs/release-incident-packet.json';

async function requestJson(route) {
  const response = await fetch(`${apiUrl}${route}`);
  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.error || `request failed with HTTP ${response.status}`);
  }
  return payload;
}

try {
  const query = new URLSearchParams({ stream, owner, visibility });
  if (decisionId) query.set('decisionId', decisionId);
  if (promotionId) query.set('promotionId', promotionId);
  if (rollbackId) query.set('rollbackId', rollbackId);
  if (provider) query.set('provider', provider);

  const payload = await requestJson(`/release/incident-packet?${query.toString()}`);
  const absoluteOutput = path.resolve(output);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  fs.writeFileSync(absoluteOutput, `${JSON.stringify(payload.packet, null, 2)}\n`);
  console.log(JSON.stringify({
    output: absoluteOutput,
    decisionId: payload.packet.decisionId,
    visibility: payload.packet.visibility,
    owner: payload.packet.owner,
    status: payload.packet.summary.status,
    artifactStatus: payload.packet.summary.artifactStatus,
    redactions: payload.packet.redactions.length,
    packetChecksum: payload.packet.packetChecksum,
  }, null, 2));
  if (payload.packet.summary.status === 'blocked') process.exit(1);
} catch (error) {
  console.error(JSON.stringify({
    decisionId,
    promotionId,
    rollbackId,
    visibility,
    status: 'blocked',
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
}
