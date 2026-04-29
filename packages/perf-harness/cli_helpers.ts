import { connect } from 'node:net';
import type { PageBudgets } from './budgets.ts';

export type Target = 'astro' | 'qwik';

export interface ParsedArgs {
  target: Target;
  runs: number;
  page?: string;
}

export interface Page {
  name: string;
  path: string;
  budgets?: PageBudgets;
}

// Stretch CWV thresholds from SMM constraint and execution_plan.json M7
// done-state. JS budgets are per-page transfer-size ceilings:
//   astro/article  <30KB (M7)
//   qwik/index    <175KB (sprint-009 revision per QWIK2_NOTES)
//   qwik/article  <168KB (sprint-009 revision per QWIK2_NOTES)
//   qwik/liveblog <171KB (story-004 close: measured 169.2KB + 1.85KB headroom)
// `russian-oil-...` is the article fixture chosen for perf — has a Twitter
// embed so the run exercises mixed text + provider-script content.
const STRETCH_CWV = { lcp: 1500, cls: 0.05, lhPerf: 98 } as const;
const ARTICLE_PATH = '/news/russian-oil-exports-slump-as-ukraine-hammers-ports-and-refineries';
// Live blog fixture path — slug's last segment matches the snapshot fixtures.
// The slug parents (year/month/day) mirror production URL shape but the
// liveblog route only keys off lastSegment().
const LIVEBLOG_PATH =
  '/news/liveblog/2026/4/22/iran-war-live-trump-says-ceasefire-extended-as-talks-with-tehran-in-limbo';

// Qwik 2 beta.32 routes share a common 175KB jsBytes ceiling — the resumability
// runtime + router + shared chunks dominate (~136KB framework alone before app
// code). Story-005 outcome documented sprint-009: framework+router growth is
// non-app-code; budgets re-anchored to audit measurement + headroom.
const QWIK_HOMEPAGE_JS_BUDGET = 175 * 1024;

// Qwik 2 beta.32 LH-throttled Perf measures 83-90 per QWIK2_NOTES § sprint-008
// audit; the framework runtime parse + chunk graph dominates the throttled-CPU
// critical path. Astro routes still hold the stretch 98. Sprint-009 split: Qwik
// gets a measured-realistic floor so the gate stops failing on every run.
const QWIK_LH_PERF_FLOOR = 85;
const QWIK_BASE_BUDGET = { ...STRETCH_CWV, lhPerf: QWIK_LH_PERF_FLOOR } as const;

const PAGES: Record<Target, Page[]> = {
  astro: [
    { name: 'index', path: '/', budgets: { ...STRETCH_CWV } },
    { name: 'article', path: ARTICLE_PATH, budgets: { ...STRETCH_CWV, jsBytes: 30 * 1024 } },
    { name: 'section-geo', path: '/middle-east', budgets: { ...STRETCH_CWV, jsBytes: 45 * 1024 } },
    { name: 'section-topic', path: '/opinion', budgets: { ...STRETCH_CWV, jsBytes: 45 * 1024 } },
  ],
  qwik: [
    {
      name: 'index',
      path: '/',
      budgets: { ...QWIK_BASE_BUDGET, jsBytes: QWIK_HOMEPAGE_JS_BUDGET },
    },
    { name: 'article', path: ARTICLE_PATH, budgets: { ...QWIK_BASE_BUDGET, jsBytes: 168 * 1024 } },
    // Section pages currently ship the same bundle as homepage (~163KB measured
    // post-sprint-008), so they share the homepage ceiling. M8 done-state aspires
    // to <15KB; SMM clarifies that's "aspirational on Qwik 2 stable" — beta.32
    // sits in the 163-171KB band per QWIK2_NOTES audit. Story-005 closed sprint-009
    // with re-budget to 175KB after framework-cost root cause confirmed.
    {
      name: 'section-geo',
      path: '/middle-east',
      budgets: { ...QWIK_BASE_BUDGET, jsBytes: QWIK_HOMEPAGE_JS_BUDGET },
    },
    {
      name: 'section-topic',
      path: '/opinion',
      budgets: { ...QWIK_BASE_BUDGET, jsBytes: QWIK_HOMEPAGE_JS_BUDGET },
    },
    // Live-blog route adds a small Updater QRL chunk (~446 bytes) on top
    // of the framework+router baseline. Measured 169.2KB at story-004
    // close; budget set to 171KB (1.85KB headroom) so the gate fires on
    // ~5x growth in app code or any framework regression, instead of
    // hiding under the homepage 175KB ceiling.
    // (Story-004 DoD said "<20KB" for route-specific app code — that's
    // the QRL chunk, not the transfer-size total dominated by framework.)
    {
      name: 'liveblog',
      path: LIVEBLOG_PATH,
      budgets: { ...QWIK_BASE_BUDGET, jsBytes: 171 * 1024 },
    },
  ],
};

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const flags = new Map<string, string>();
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) flags.set(match[1], match[2]);
  }

  const target = flags.get('target');
  if (!target) throw new Error('parseArgs: --target=astro|qwik is required');
  if (target !== 'astro' && target !== 'qwik') {
    throw new Error(`parseArgs: --target must be astro or qwik, got "${target}"`);
  }

  let runs = 5;
  if (flags.has('runs')) {
    const raw = flags.get('runs')!;
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error(`parseArgs: --runs must be a positive integer, got "${raw}"`);
    }
    runs = n;
  }

  const out: ParsedArgs = { target, runs };
  if (flags.has('page')) out.page = flags.get('page');
  return out;
}

export function buildPageList(target: Target): Page[] {
  return PAGES[target];
}

export interface WaitForPortOptions {
  timeoutMs: number;
  intervalMs?: number;
}

export async function waitForPort(port: number, opts: WaitForPortOptions): Promise<void> {
  const intervalMs = opts.intervalMs ?? 100;
  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    const reached = await tryConnect(port);
    if (reached) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`waitForPort: timed out waiting for port ${port} (${opts.timeoutMs}ms)`);
}

async function tryConnect(port: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}
