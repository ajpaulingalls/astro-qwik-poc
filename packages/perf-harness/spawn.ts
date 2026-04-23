// Process-spawn primitives for the perf-harness AND browser acceptance
// tests. Both consumers need the same lifecycle (mock-api + target app
// with their respective production runtimes) so this module is the single
// source of truth for "how do we boot a target app the way it'd run in
// prod, with its mock-api dependency."
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Target } from './cli_helpers.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, '../..');

// One mock-api instance per target so test-astro and test-qwik can run in
// parallel under lefthook without colliding on a single shared port.
// Both instances load the same fixture directory — same data, two listeners.
export const MOCK_API_PORT: Record<Target, number> = { astro: 4455, qwik: 4456 };
export const APP_PORT: Record<Target, number> = { astro: 8080, qwik: 4173 };

export function spawnMockApi(target: Target): ChildProcess {
  const port = MOCK_API_PORT[target];
  return spawn(
    'deno',
    [
      'run',
      `--allow-net=0.0.0.0:${port}`,
      '--allow-read=./fixtures',
      '--allow-env=PORT,FIXTURE_DIR',
      'server.ts',
    ],
    {
      cwd: resolve(REPO_ROOT, 'packages/mock-api'),
      stdio: 'ignore',
      env: { ...process.env, PORT: String(port) },
    },
  );
}

// Audited against apps/astro/dist/server/{entry.mjs,chunks/*.mjs} and
// node_modules/@deno/astro-adapter/src/server.ts. The adapter wraps every
// env read through `setGetEnv((key) => Deno.env.get(key))`, so any key
// referenced in compiled chunks must be allowed.
//
// To re-derive after an Astro upgrade, run from repo root:
//   grep -rh -oE 'env\.[A-Za-z_][A-Za-z0-9_]*' apps/astro/dist/server/ | sort -u
//   grep -rh -oE 'n\.[A-Z][A-Z_]*' apps/astro/dist/server/ | sort -u   # destructured
//
// Categorized:
//   NODE_ENV, NODE_DEBUG — Astro/Vite core
//   ASTRO_INTERNAL_TEST_DISABLE_CONSOLE_FILTER — Astro test hook (defended)
//   CI, NO_COLOR, FORCE_COLOR, TERM — picocolors color detection (destructured)
//   PKG_CONFIG_PATH, SHARP_*, npm_package_config_libvips — sharp probe
//
// Adapter binds port/hostname at build time (options.port, options.hostname),
// not via env, so HOST/PORT are not allowed.
export const ASTRO_ALLOWED_ENV = [
  'NODE_ENV',
  'NODE_DEBUG',
  'ASTRO_INTERNAL_TEST_DISABLE_CONSOLE_FILTER',
  'CI',
  'NO_COLOR',
  'FORCE_COLOR',
  'TERM',
  'PKG_CONFIG_PATH',
  'SHARP_FORCE_GLOBAL_LIBVIPS',
  'SHARP_IGNORE_GLOBAL_LIBVIPS',
  'npm_package_config_libvips',
].join(',');

export function spawnAstro(): ChildProcess {
  return spawn(
    'deno',
    [
      'run',
      `--allow-net=0.0.0.0:${APP_PORT.astro},localhost:${MOCK_API_PORT.astro}`,
      '--allow-read=apps/astro/dist',
      `--allow-env=${ASTRO_ALLOWED_ENV}`,
      'apps/astro/dist/server/entry.mjs',
    ],
    { cwd: REPO_ROOT, stdio: 'ignore' },
  );
}

export function spawnQwik(): ChildProcess {
  // Spawn the production-bundled handler via a Node http wrapper instead
  // of `vite preview`, so the methodology matches spawnAstro's `deno run
  // dist/server/entry.mjs` (raw runtime, no Vite middleware in front).
  // See apps/qwik/server.ts and QWIK2_NOTES.md for why a wrapper is
  // required (entry.preview.js exports middleware, not a listener).
  // PUBLIC_API_BASE injects the Qwik-target mock-api port at runtime so
  // the source DEFAULT_API_BASE can stay 4455 (standalone dev with
  // `bun run mock-api` keeps working).
  return spawn('node', ['--experimental-strip-types', '--no-warnings', 'server.ts'], {
    cwd: resolve(REPO_ROOT, 'apps/qwik'),
    stdio: 'ignore',
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(APP_PORT.qwik),
      PUBLIC_API_BASE: `http://localhost:${MOCK_API_PORT.qwik}`,
    },
  });
}

export function spawnApp(target: Target): ChildProcess {
  return target === 'astro' ? spawnAstro() : spawnQwik();
}

export function killService(proc: ChildProcess): Promise<void> {
  if (proc.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const killTimer = setTimeout(() => proc.kill('SIGKILL'), 2000);
    proc.once('exit', () => {
      clearTimeout(killTimer);
      resolve();
    });
    if (proc.exitCode !== null) {
      clearTimeout(killTimer);
      resolve();
      return;
    }
    proc.kill('SIGTERM');
  });
}
