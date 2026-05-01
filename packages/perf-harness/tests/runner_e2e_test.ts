// Real end-to-end CSP regression gate. NOT a unit test — spawns mock-api,
// app build, lighthouse, chrome+collector. Gated on PERF_E2E=1 so default
// `bun test` stays fast.
//
// Run via: `bun run perf:e2e-csp` (root package.json) — that script builds
// both apps with the right PUBLIC_API_BASE and sets PERF_E2E=1.
//
// Why: story-004 audit shipped CSP-clean across all (target, page) combos.
// This test fails the moment a regression reintroduces a violation, before
// it lands in committed reports/*.json. Catches the build-time API-base
// drift class (the Qwik 4455 vs 4456 bug fixed last sprint) via the same
// surface the operator checks at sweep time.
//
// Precondition: dist/ for each app must exist. Skips with a clear message
// otherwise — `bun run perf:e2e-csp` handles the build automatically.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from '@aje-poc/shared-test-helpers';

vi.hoisted(() => {
  const tmp = (process.env.TMPDIR ?? '/tmp').replace(/\/$/, '');
  process.env.PERF_REPORTS_DIR = `${tmp}/perf-runner-e2e-${process.pid}`;
});

import { REPORTS_DIR, REPORTS_DIR_ENV, type AggregatedReport } from '../reporter.ts';
import { main as runnerMain } from '../runner.ts';

// Defensive: don't rmSync a path the env-override didn't redirect. Mirrors
// runner_test.ts's assertScopedReportsDir guard.
function assertScopedReportsDir() {
  if (process.env[REPORTS_DIR_ENV] !== REPORTS_DIR) {
    throw new Error(
      `runner_e2e_test refuses to clean REPORTS_DIR=${REPORTS_DIR} (env not honored — hoisting regressed)`,
    );
  }
}

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
  afterAll(() => {
    assertScopedReportsDir();
    rmSync(REPORTS_DIR, { recursive: true, force: true });
  });

  it.each(['astro', 'qwik'] as const)(
    '%s article+liveblog emit zero CSP violations on a real run',
    async (target) => {
      // Trim to article + liveblog — story-004's CSP-rich pages where the
      // sanitizers + collector landed. Index/section had zero violations to
      // begin with so they don't add regression-coverage value here. ~2 min
      // savings per gate run vs running all pages.
      //
      // runner.ts writes reports before throwing on Budget violations
      // (runner.ts:122). n=1 lighthouse measurements vary at the noise floor;
      // swallow budget errors so this test stays focused on CSP regression
      // rather than re-validating perf budgets that already gate at sweep time.
      try {
        await runnerMain([`--target=${target}`, '--runs=1', '--page=article,liveblog']);
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
