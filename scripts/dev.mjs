import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const defaults = {
  NODE_ENV: 'development',
  PORT: '3001',
  FRONTEND_URL: 'http://localhost:5173',
  REACT_APP_API_URL: 'http://localhost:3001/api',
  VITE_API_URL: 'http://localhost:3001/api',
  DATABASE_PATH: './data/slotgpt.db',
  ENABLE_WORKERS: 'false',
  LOG_LEVEL: 'info',
};

const children = [
  spawn(npm, ['run', 'dev', '--prefix', 'apps/backend'], {
    stdio: 'inherit',
    env: { ...defaults, ...process.env },
  }),
  spawn(npm, ['run', 'dev', '--prefix', 'apps/frontend'], {
    stdio: 'inherit',
    env: { ...defaults, ...process.env },
  }),
];

let shuttingDown = false;

function stop(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => stop(signal));
}

for (const child of children) {
  child.on('exit', code => {
    if (!shuttingDown && code && code !== 0) {
      stop();
      process.exit(code);
    }
  });
}
