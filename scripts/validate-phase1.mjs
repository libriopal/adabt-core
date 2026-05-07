import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);

function run(label, command, args, env = {}) {
  console.log(`\n[phase1] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...env },
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run('sqlite migration runner', 'npm', ['run', 'migrate'], {
  DATABASE_PROVIDER: 'sqlite',
  DATABASE_PATH: ':memory:',
});
run('phase 0 validation chain', 'npm', ['run', 'validate:phase0']);
