// M11 live-endpoint demo launcher for Qwik. Mirrors demo-launch-astro.ts.
// Invoked from `bun run demo:qwik` after `bun run build:qwik`.
import { decideChildExitAction, spawnQwik } from '@aje-poc/perf-harness/spawn';

const child = spawnQwik('inherit');

child.on('exit', (code, signal) => {
  const action = decideChildExitAction(code, signal);
  if (action.kind === 'signal') process.kill(process.pid, action.signal);
  else process.exit(action.code);
});
