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
const promotionId = args.get('promotion-id') || process.env.AGROS_RELEASE_PROMOTION_ID || '';
const output = args.get('output') || process.env.AGROS_RELEASE_PROMOTION_TIMELINE_PATH || 'outputs/release-promotion-timeline.json';

async function requestJson(route) {
  const response = await fetch(`${apiUrl}${route}`);
  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.error || `request failed with HTTP ${response.status}`);
  }
  return payload;
}

try {
  if (!promotionId) {
    throw new Error('promotion id is required; pass --promotion-id or AGROS_RELEASE_PROMOTION_ID');
  }

  const payload = await requestJson(`/release/promotions/${encodeURIComponent(promotionId)}/timeline`);
  const absoluteOutput = path.resolve(output);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  fs.writeFileSync(absoluteOutput, `${JSON.stringify(payload.timeline, null, 2)}\n`);
  console.log(JSON.stringify({
    output: absoluteOutput,
    promotionId,
    status: payload.timeline.promotion.status,
    timelineEvents: payload.timeline.timeline.length,
    ciChecks: payload.timeline.ciChecks.length,
    exportChecksum: payload.timeline.exportChecksum,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    promotionId,
    status: 'blocked',
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
}
