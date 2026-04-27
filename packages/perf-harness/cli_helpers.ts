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
//   qwik/index    <165KB (sprint-006 revision per QWIK2_NOTES)
//   qwik/article  <155KB (A4 reconciliation per ARCHITECTURE.md)
// `russian-oil-...` is the article fixture chosen for perf — has a Twitter
// embed so the run exercises mixed text + provider-script content.
const STRETCH_CWV = { lcp: 1500, cls: 0.05, lhPerf: 98 } as const;
const ARTICLE_PATH = '/news/russian-oil-exports-slump-as-ukraine-hammers-ports-and-refineries';

// Qwik 2 beta.32 routes share a common 165KB jsBytes ceiling — the resumability
// runtime + router + shared chunks dominate. Story-005 (Qwik JS budget reduction)
// will tighten this. Until then, all Qwik routes get the same ceiling so the gate
// flags genuine regressions rather than re-litigating the systemic posture.
const QWIK_HOMEPAGE_JS_BUDGET = 165 * 1024;

const PAGES: Record<Target, Page[]> = {
  astro: [
    { name: 'index', path: '/', budgets: { ...STRETCH_CWV } },
    { name: 'article', path: ARTICLE_PATH, budgets: { ...STRETCH_CWV, jsBytes: 30 * 1024 } },
    { name: 'section-geo', path: '/middle-east', budgets: { ...STRETCH_CWV, jsBytes: 45 * 1024 } },
    { name: 'section-topic', path: '/opinion', budgets: { ...STRETCH_CWV, jsBytes: 45 * 1024 } },
  ],
  qwik: [
    { name: 'index', path: '/', budgets: { ...STRETCH_CWV, jsBytes: QWIK_HOMEPAGE_JS_BUDGET } },
    { name: 'article', path: ARTICLE_PATH, budgets: { ...STRETCH_CWV, jsBytes: 155 * 1024 } },
    // Section pages currently ship the same bundle as homepage (~158KB measured),
    // so they share the homepage ceiling. M8 done-state aspires to <15KB; SMM
    // clarifies that's "aspirational on Qwik 2 stable" — beta.32 sits in the
    // 155-165KB band. Story-005 tightens across the board.
    {
      name: 'section-geo',
      path: '/middle-east',
      budgets: { ...STRETCH_CWV, jsBytes: QWIK_HOMEPAGE_JS_BUDGET },
    },
    {
      name: 'section-topic',
      path: '/opinion',
      budgets: { ...STRETCH_CWV, jsBytes: QWIK_HOMEPAGE_JS_BUDGET },
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
