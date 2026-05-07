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
const manifestPath = args.get('manifest') || process.env.AGROS_RELEASE_MANIFEST_PATH || 'outputs/release-evidence-manifest.json';
const output = args.get('output') || process.env.AGROS_RELEASE_VERIFICATION_PATH || 'outputs/release-artifact-verification.json';

const artifactArgs = {
  release_evidence: args.get('release-evidence') || process.env.AGROS_RELEASE_ARTIFACT_PATH || '',
  release_bundle_summary: args.get('release-bundle') || process.env.AGROS_RELEASE_BUNDLE_PATH || '',
  promotion_timeline: args.get('promotion-timeline') || process.env.AGROS_RELEASE_PROMOTION_TIMELINE_PATH || '',
  rollback_timeline: args.get('rollback-timeline') || process.env.AGROS_RELEASE_ROLLBACK_TIMELINE_PATH || '',
};

function readJson(filePath) {
  if (!filePath) return undefined;
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) return undefined;
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

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
  const manifest = readJson(manifestPath);
  if (!manifest) {
    throw new Error(`manifest not found: ${manifestPath}`);
  }
  const artifacts = Object.fromEntries(
    Object.entries(artifactArgs)
      .map(([kind, filePath]) => [kind, readJson(filePath)])
      .filter(([, artifact]) => artifact),
  );
  const payload = await requestJson('/release/evidence/verify-artifacts', { manifest, artifacts });
  const absoluteOutput = path.resolve(output);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  fs.writeFileSync(absoluteOutput, `${JSON.stringify(payload.verification, null, 2)}\n`);
  console.log(JSON.stringify({
    output: absoluteOutput,
    status: payload.verification.status,
    matched: payload.verification.artifacts.filter(artifact => artifact.matched).length,
    total: payload.verification.artifacts.length,
    mismatches: payload.verification.mismatches,
  }, null, 2));
  if (payload.verification.status === 'blocked') process.exit(1);
} catch (error) {
  console.error(JSON.stringify({
    status: 'blocked',
    manifest: manifestPath,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
}
