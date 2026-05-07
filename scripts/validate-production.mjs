import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);

function run(label, command, args, options = {}) {
  console.log(`\n[validate] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run('frontend build', 'npm', ['run', 'build', '--prefix', 'apps/frontend']);
run('backend build', 'npm', ['run', 'build', '--prefix', 'apps/backend']);
run('backend tests', 'npm', ['test', '--prefix', 'apps/backend']);

const tsx = resolve(root, 'apps/backend/node_modules/.bin/tsx');
if (!existsSync(tsx)) {
  console.error('[validate] missing apps/backend tsx binary; run npm ci --prefix apps/backend');
  process.exit(1);
}

run('deterministic replay and cocoon parity', tsx, [
  '-e',
  `
    import { runEvolutionSimulation } from './apps/frontend/src/evolution/simulator';
    import { createCocoonState } from './apps/frontend/src/cocoon/serializer';
    import { verifyCocoonReplay, verifyReconstruction } from './apps/frontend/src/cocoon/verifier';
    const a = runEvolutionSimulation({ seed: 'prod-validate', epochs: 4, populationSize: 12 });
    const b = runEvolutionSimulation({ seed: 'prod-validate', epochs: 4, populationSize: 12 });
    if (a.checkpoint.deterministicChecksum !== b.checkpoint.deterministicChecksum) {
      throw new Error('evolution replay checksum mismatch');
    }
    const reconstruction = verifyReconstruction(createCocoonState('prod-validate'));
    if (!reconstruction.stable) throw new Error('cocoon reconstruction is unstable');
    const cocoon = verifyCocoonReplay('prod-validate');
    if (!cocoon.stable) throw new Error('cocoon replay is unstable');
    console.log(JSON.stringify({
      evolutionChecksum: a.checkpoint.deterministicChecksum,
      cocoonChecksum: cocoon.checksum,
      reconstructionChecksum: reconstruction.checksum
    }));
  `,
]);

run('diff whitespace check', 'git', ['diff', '--check']);
