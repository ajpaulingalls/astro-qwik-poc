// M11 live-endpoint demo launcher for Astro. Mirrors demo-launch-qwik.ts.
// Invoked from `bun run demo:astro` after `bun run build:astro`.
import { decideChildExitAction, spawnAstro } from '@aje-poc/perf-harness/spawn';

const child = spawnAstro('inherit');

child.on('exit', (code, signal) => {
  const action = decideChildExitAction(code, signal);
  if (action.kind === 'signal') process.kill(process.pid, action.signal);
  else process.exit(action.code);
});
