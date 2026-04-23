import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Metric } from 'web-vitals';
import { median } from './aggregator.ts';
import { withChrome } from './chrome.ts';
import { runLighthouseAudit, type RawMetrics } from './lighthouse.ts';
import { formatReport, type AggregatedMetric, type AggregatedReport } from './reporter.ts';
import { buildPageList, parseArgs, waitForPort, type Target } from './cli_helpers.ts';
import { collectWebVitals } from './web_vitals_collector.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const REPORTS_DIR = resolve(__dirname, 'reports');

const MOCK_API_PORT = 4455;
const APP_PORT: Record<Target, number> = { astro: 8080, qwik: 4173 };

function spawnMockApi(): ChildProcess {
  return spawn(
    'deno',
    [
      'run',
      '--allow-net=0.0.0.0:4455',
      '--allow-read=./fixtures',
      '--allow-env=PORT,FIXTURE_DIR',
      'server.ts',
    ],
    { cwd: resolve(REPO_ROOT, 'packages/mock-api'), stdio: 'ignore' },
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
const ASTRO_ALLOWED_ENV = [
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

function spawnAstro(): ChildProcess {
  return spawn(
    'deno',
    [
      'run',
      '--allow-net=0.0.0.0:8080,localhost:4455',
      '--allow-read=apps/astro/dist',
      `--allow-env=${ASTRO_ALLOWED_ENV}`,
      'apps/astro/dist/server/entry.mjs',
    ],
    { cwd: REPO_ROOT, stdio: 'ignore' },
  );
}

function spawnQwik(): ChildProcess {
  // Spawn the production-bundled handler via a Node http wrapper instead
  // of `vite preview`, so the methodology matches spawnAstro's `deno run
  // dist/server/entry.mjs` (raw runtime, no Vite middleware in front).
  // See apps/qwik/server.ts and QWIK2_NOTES.md for why a wrapper is
  // required (entry.preview.js exports middleware, not a listener).
  return spawn('node', ['--experimental-strip-types', '--no-warnings', 'server.ts'], {
    cwd: resolve(REPO_ROOT, 'apps/qwik'),
    stdio: 'ignore',
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(APP_PORT.qwik) },
  });
}

function spawnApp(target: Target): ChildProcess {
  return target === 'astro' ? spawnAstro() : spawnQwik();
}

function killService(proc: ChildProcess): Promise<void> {
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

function aggMetric(values: number[], n: number): AggregatedMetric {
  return { median: median(values), n };
}

function aggregateRuns(runs: RawMetrics[], n: number): AggregatedReport['metrics'] {
  return {
    lcp: aggMetric(
      runs.map((r) => r.lcp),
      n,
    ),
    cls: aggMetric(
      runs.map((r) => r.cls),
      n,
    ),
    lhPerf: aggMetric(
      runs.map((r) => r.lhPerf),
      n,
    ),
    jsBytes: aggMetric(
      runs.map((r) => r.jsBytes),
      n,
    ),
  };
}

function writeReports(
  target: Target,
  page: string,
  formatted: { json: string; markdown: string },
): void {
  mkdirSync(REPORTS_DIR, { recursive: true });
  const stem = `${target}-${page}`;
  writeFileSync(resolve(REPORTS_DIR, `${stem}.json`), formatted.json + '\n');
  writeFileSync(resolve(REPORTS_DIR, `${stem}.md`), formatted.markdown);
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const pages = buildPageList(args.target).filter((p) => !args.page || p.name === args.page);
  if (pages.length === 0) {
    throw new Error(`runner: no pages match --page=${args.page}`);
  }

  const services = [spawnMockApi(), spawnApp(args.target)];

  try {
    await Promise.all([
      waitForPort(MOCK_API_PORT, { timeoutMs: 10_000 }),
      waitForPort(APP_PORT[args.target], { timeoutMs: 60_000 }),
    ]);

    for (const page of pages) {
      const url = `http://localhost:${APP_PORT[args.target]}${page.path}`;
      const samples: RawMetrics[] = [];
      const wvSamples: Metric[] = [];
      for (let i = 0; i < args.runs; i++) {
        process.stderr.write(`[${args.target}/${page.name}] run ${i + 1}/${args.runs}\n`);
        samples.push(await runLighthouseAudit(url));
        wvSamples.push(...(await withChrome((port) => collectWebVitals(url, port))));
      }
      const report: AggregatedReport = {
        page: page.name,
        target: args.target,
        metrics: aggregateRuns(samples, args.runs),
        webVitals: { samples: wvSamples },
      };
      const formatted = formatReport(report);
      writeReports(args.target, page.name, formatted);
      process.stdout.write(formatted.markdown);
    }
  } finally {
    await Promise.all(services.map(killService));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`perf-harness: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
