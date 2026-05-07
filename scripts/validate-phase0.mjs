import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);

function run(label, command, args) {
  console.log(`\n[phase0] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

for (const file of [
  'package.json',
  'apps/frontend/package.json',
  'apps/backend/package.json',
  'scripts/dev.mjs',
  'scripts/validate-production.mjs',
]) {
  if (!existsSync(resolve(root, file))) {
    console.error(`[phase0] missing required local runtime file: ${file}`);
    process.exit(1);
  }
}

run('frontend build', 'npm', ['run', 'build', '--prefix', 'apps/frontend']);
run('backend build', 'npm', ['run', 'build', '--prefix', 'apps/backend']);
run('backend tests', 'npm', ['test', '--prefix', 'apps/backend']);
run('production replay smoke', 'node', ['scripts/validate-production.mjs']);
