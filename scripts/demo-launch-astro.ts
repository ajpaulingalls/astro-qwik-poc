// M11 live-endpoint demo launcher. Argv composition shared with spawnAstro
// via buildAstroDenoArgv to prevent flag drift between demo and perf-harness.
// Invoked from `bun run demo:astro` after `bun run build:astro`.
import { spawn } from 'node:child_process';
import { APP_PORT, buildAstroDenoArgv, decideChildExitAction } from '@aje-poc/perf-harness/spawn';

const argv = buildAstroDenoArgv(process.env.PUBLIC_API_BASE, APP_PORT.astro);
const child = spawn('deno', argv, { stdio: 'inherit' });

child.on('exit', (code, signal) => {
  const action = decideChildExitAction(code, signal);
  if (action.kind === 'signal') process.kill(process.pid, action.signal);
  else process.exit(action.code);
});
