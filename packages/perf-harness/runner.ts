import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { median } from './aggregator.ts';
import { withChrome } from './chrome.ts';
import { runLighthouseAudit, type RawMetrics } from './lighthouse.ts';
import {
  formatReport,
  MISSING_METRIC,
  type AggregatedMetric,
  type AggregatedReport,
} from './reporter.ts';
import { buildPageList, parseArgs, waitForPort, type Target } from './cli_helpers.ts';
import { checkBudgets } from './budgets.ts';
import { collectWebVitals, type EnrichedMetric } from './web_vitals_collector.ts';
import { APP_PORT, MOCK_API_PORT, killService, spawnApp, spawnMockApi } from './spawn.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = resolve(__dirname, 'reports');

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

  const services = [spawnMockApi(args.target), spawnApp(args.target)];
  const allViolations: string[] = [];

  try {
    await Promise.all([
      waitForPort(MOCK_API_PORT[args.target], { timeoutMs: 10_000 }),
      waitForPort(APP_PORT[args.target], { timeoutMs: 60_000 }),
    ]);

    for (const page of pages) {
      const url = `http://localhost:${APP_PORT[args.target]}${page.path}`;
      const samples: RawMetrics[] = [];
      const wvSamples: EnrichedMetric[] = [];
      for (let i = 0; i < args.runs; i++) {
        process.stderr.write(`[${args.target}/${page.name}] run ${i + 1}/${args.runs}\n`);
        samples.push(await runLighthouseAudit(url));
        wvSamples.push(...(await withChrome((port) => collectWebVitals(url, port))));
      }
      // n = sample count, not run count. They match in practice (collectWebVitals
      // resolves once per nav with 1 LCP + 1 INP entry), but if web-vitals ever
      // reports multiple candidates per page the sample count diverges from args.runs.
      const lcpValues = wvSamples.filter((s) => s.name === 'LCP').map((s) => s.value);
      const inpValues = wvSamples.filter((s) => s.name === 'INP').map((s) => s.value);
      // MISSING_METRIC keeps real-browser gaps visible — see AggregatedMetric (SMM be23cb2d0a70).
      const aggregatedLcp =
        lcpValues.length > 0 ? aggMetric(lcpValues, lcpValues.length) : MISSING_METRIC;
      const aggregatedInp =
        inpValues.length > 0 ? aggMetric(inpValues, inpValues.length) : MISSING_METRIC;
      const report: AggregatedReport = {
        page: page.name,
        target: args.target,
        metrics: aggregateRuns(samples, args.runs),
        webVitals: {
          samples: wvSamples,
          aggregated: { lcp: aggregatedLcp, inp: aggregatedInp },
        },
      };
      const formatted = formatReport(report);
      writeReports(args.target, page.name, formatted);
      process.stdout.write(formatted.markdown);

      const violations = checkBudgets(report, page.budgets, args.target, page.name);
      if (violations.length > 0) {
        for (const v of violations) process.stderr.write(`${v}\n`);
        allViolations.push(...violations);
      }
    }
  } finally {
    await Promise.all(services.map(killService));
  }

  // Throw AFTER reports are written and services are killed, so CI artifacts
  // are preserved even when the budget gate fails.
  if (allViolations.length > 0) {
    throw new Error(`Budget violations:\n${allViolations.join('\n')}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`perf-harness: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
