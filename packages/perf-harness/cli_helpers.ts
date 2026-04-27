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

const PAGES: Record<Target, Page[]> = {
  astro: [
    { name: 'index', path: '/', budgets: { ...STRETCH_CWV } },
    { name: 'article', path: ARTICLE_PATH, budgets: { ...STRETCH_CWV, jsBytes: 30 * 1024 } },
  ],
  qwik: [
    { name: 'index', path: '/', budgets: { ...STRETCH_CWV, jsBytes: 165 * 1024 } },
    { name: 'article', path: ARTICLE_PATH, budgets: { ...STRETCH_CWV, jsBytes: 155 * 1024 } },
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
