#!/usr/bin/env node

const args = new Map(
  process.argv.slice(2).map(arg => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.join('=') || 'true'];
  }),
);

const apiUrl = (args.get('api-url') || process.env.AGROS_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const promotionId = args.get('promotion-id') || process.env.AGROS_RELEASE_PROMOTION_ID || '';
const name = args.get('name') || process.env.AGROS_RELEASE_CI_CHECK_NAME || 'github-actions';
const status = args.get('status') || process.env.AGROS_RELEASE_CI_CHECK_STATUS || 'passed';
const url = args.get('url') || process.env.AGROS_RELEASE_CI_CHECK_URL || '';
const detail = args.get('detail') || process.env.AGROS_RELEASE_CI_CHECK_DETAIL || 'CI monitor result attached by release automation';

async function requestJson(route, body) {
  const response = await fetch(`${apiUrl}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
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

  const payload = await requestJson(`/release/promotions/${encodeURIComponent(promotionId)}/ci-checks`, {
    name,
    status,
    url: url || undefined,
    detail,
  });

  console.log(JSON.stringify({
    promotionId,
    status: payload.promotion.status,
    ciChecks: payload.promotion.ciChecks.length,
    latestCiCheck: payload.promotion.ciChecks[payload.promotion.ciChecks.length - 1],
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    promotionId,
    status: 'blocked',
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
}
