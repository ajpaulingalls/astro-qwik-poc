// Real end-to-end CSP regression gate. NOT a unit test — spawns mock-api,
// app build, lighthouse, chrome+collector. Gated on PERF_E2E=1 so default
// `bun test` stays fast. Wire into perf:* sweeps with the env var set.
//
// Why: story-004 audit shipped CSP-clean across all (target, page) combos.
// This test fails the moment a regression reintroduces a violation, before
// it lands in committed reports/*.json. Catches the build-time API-base
// drift class (the Qwik 4455 vs 4456 bug fixed last sprint) via the same
// surface the operator checks at sweep time.
//
// Precondition: dist/ for each app must exist. Skips with a clear message
// otherwise — operator runs `bun run build:astro && PUBLIC_API_BASE=http://localhost:4456 bun run build:qwik` first.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from '@aje-poc/shared-test-helpers';

vi.hoisted(() => {
  const tmp = (process.env.TMPDIR ?? '/tmp').replace(/\/$/, '');
  process.env.PERF_REPORTS_DIR = `${tmp}/perf-runner-e2e-${process.pid}`;
});

import { REPORTS_DIR, type AggregatedReport } from '../reporter.ts';
import { main as runnerMain } from '../runner.ts';

const E2E = process.env.PERF_E2E === '1';
const ASTRO_DIST = resolve(REPO_ROOT, 'apps/astro/dist');
const QWIK_DIST = resolve(REPO_ROOT, 'apps/qwik/dist');

function readReports(target: 'astro' | 'qwik'): AggregatedReport[] {
  return readdirSync(REPORTS_DIR)
    .filter((f) => f.startsWith(`${target}-`) && f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(resolve(REPORTS_DIR, f), 'utf8')) as AggregatedReport);
}

describe.skipIf(!E2E)('runner e2e CSP regression gate', () => {
  beforeAll(() => {
    if (!existsSync(ASTRO_DIST) || !existsSync(QWIK_DIST)) {
      throw new Error(
        `runner_e2e_test requires both apps built. Run: bun run build:astro && PUBLIC_API_BASE=http://localhost:4456 bun run build:qwik`,
      );
    }
  });

  it.each(['astro', 'qwik'] as const)(
    '%s pages emit zero CSP violations on a real run',
    async (target) => {
      // runner.ts writes reports before throwing on Budget violations
      // (runner.ts:122). n=1 lighthouse measurements vary at the noise floor;
      // swallow budget errors so this test stays focused on CSP regression
      // rather than re-validating perf budgets that already gate at sweep time.
      try {
        await runnerMain([`--target=${target}`, '--runs=1']);
      } catch (err) {
        if (!(err instanceof Error) || !/Budget violations/.test(err.message)) throw err;
      }
      const reports = readReports(target);
      expect(reports.length).toBeGreaterThan(0);
      for (const report of reports) {
        expect(report.cspViolations, `${target}/${report.page} cspViolations`).toEqual([]);
      }
    },
    300_000,
  );
});
