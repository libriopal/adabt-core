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
const provider = args.get('provider') || process.env.AGROS_RELEASE_PROVIDER || 'railway';
const stream = args.get('stream') || process.env.AGROS_REPLAY_STREAM || 'agros-replay-suite';
const environment = args.get('environment') || process.env.AGROS_RELEASE_ENVIRONMENT || 'staging';
const output = args.get('output') || process.env.AGROS_RELEASE_BUNDLE_PATH || `outputs/release-bundle-summary-${environment}.json`;

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
    environment,
  });
  if (decisionId) query.set('decisionId', decisionId);

  const bundlePayload = await requestJson(`/release/bundle-summary?${query.toString()}`);
  const cardQuery = new URLSearchParams({ decisionId: bundlePayload.bundle.decision.id, environment });
  const cardPayload = await requestJson(`/release/supervision-card?${cardQuery.toString()}`);
  const artifact = {
    version: 'agros-release-supervision-publication-v1',
    publishedAt: Date.now(),
    environment,
    bundle: bundlePayload.bundle,
    supervisionCard: cardPayload.card,
  };
  const absoluteOutput = path.resolve(output);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  fs.writeFileSync(absoluteOutput, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify({
    output: absoluteOutput,
    environment,
    decisionId: artifact.bundle.decision.id,
    bundleChecksum: artifact.bundle.bundleChecksum,
    cardChecksum: artifact.supervisionCard.cardChecksum,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    environment,
    provider,
    stream,
    status: 'blocked',
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
}
