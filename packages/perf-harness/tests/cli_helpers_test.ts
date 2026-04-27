import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:net';
import { buildPageList, parseArgs, waitForPort } from '../cli_helpers.ts';

describe('parseArgs', () => {
  it('parses --target=astro with default runs=5', () => {
    expect(parseArgs(['--target=astro'])).toEqual({ target: 'astro', runs: 5 });
  });

  it('parses --target=qwik with --runs=10', () => {
    expect(parseArgs(['--target=qwik', '--runs=10'])).toEqual({ target: 'qwik', runs: 10 });
  });

  it('parses --page=index filter', () => {
    expect(parseArgs(['--target=astro', '--page=index'])).toEqual({
      target: 'astro',
      runs: 5,
      page: 'index',
    });
  });

  it('throws when --target is missing', () => {
    expect(() => parseArgs([])).toThrow(/--target/);
  });

  it('throws on invalid target value', () => {
    expect(() => parseArgs(['--target=svelte'])).toThrow(/astro|qwik/);
  });

  it('throws when --runs is not a positive integer', () => {
    expect(() => parseArgs(['--target=astro', '--runs=zero'])).toThrow(/runs/i);
    expect(() => parseArgs(['--target=astro', '--runs=0'])).toThrow(/runs/i);
    expect(() => parseArgs(['--target=astro', '--runs=-3'])).toThrow(/runs/i);
  });
});

describe('buildPageList', () => {
  it('returns at least one page for astro', () => {
    const pages = buildPageList('astro');
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages.find((p) => p.name === 'index')).toBeDefined();
  });

  it('returns at least one page for qwik', () => {
    const pages = buildPageList('qwik');
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages.find((p) => p.name === 'index')).toBeDefined();
  });

  it('every page has a path starting with /', () => {
    for (const target of ['astro', 'qwik'] as const) {
      for (const page of buildPageList(target)) {
        expect(page.path.startsWith('/')).toBe(true);
      }
    }
  });

  it('exposes an article page for both targets at /news/<slug>', () => {
    for (const target of ['astro', 'qwik'] as const) {
      const article = buildPageList(target).find((p) => p.name === 'article');
      expect(article).toBeDefined();
      expect(article!.path.startsWith('/news/')).toBe(true);
    }
  });

  it('every page declares stretch-CWV budgets (lcp + cls + lhPerf)', () => {
    for (const target of ['astro', 'qwik'] as const) {
      for (const page of buildPageList(target)) {
        expect(page.budgets).toBeDefined();
        expect(page.budgets!.lcp).toBe(1500);
        expect(page.budgets!.cls).toBe(0.05);
        expect(page.budgets!.lhPerf).toBe(98);
      }
    }
  });

  it('article pages declare a per-app jsBytes budget', () => {
    const astroArticle = buildPageList('astro').find((p) => p.name === 'article')!;
    expect(astroArticle.budgets!.jsBytes).toBe(30 * 1024);
    const qwikArticle = buildPageList('qwik').find((p) => p.name === 'article')!;
    expect(qwikArticle.budgets!.jsBytes).toBe(155 * 1024);
  });

  it('qwik index declares a 165KB jsBytes budget (sprint-006 revision)', () => {
    const qwikIndex = buildPageList('qwik').find((p) => p.name === 'index')!;
    expect(qwikIndex.budgets!.jsBytes).toBe(165 * 1024);
  });

  it('exposes section-geo and section-topic pages for both targets', () => {
    for (const target of ['astro', 'qwik'] as const) {
      const pages = buildPageList(target);
      const geo = pages.find((p) => p.name === 'section-geo');
      const topic = pages.find((p) => p.name === 'section-topic');
      expect(geo, `${target} section-geo`).toBeDefined();
      expect(topic, `${target} section-topic`).toBeDefined();
      // Geographic vs topic distinction comes from the per-app section-type
      // allowlist (apps/*/src/lib/section-type.ts). middle-east is geographic;
      // opinion is topic. Hardcoding here keeps perf-harness independent of
      // the apps' allowlists — a drift will fail the section-type tests, not
      // this gate.
      expect(geo!.path).toBe('/middle-east');
      expect(topic!.path).toBe('/opinion');
    }
  });

  it('astro section pages declare a 45KB jsBytes budget', () => {
    for (const name of ['section-geo', 'section-topic'] as const) {
      const page = buildPageList('astro').find((p) => p.name === name)!;
      expect(page.budgets!.jsBytes).toBe(45 * 1024);
    }
  });

  it('qwik section pages share the homepage 165KB jsBytes ceiling', () => {
    for (const name of ['section-geo', 'section-topic'] as const) {
      const page = buildPageList('qwik').find((p) => p.name === name)!;
      expect(page.budgets!.jsBytes).toBe(165 * 1024);
    }
  });
});

describe('waitForPort', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
  });

  it('resolves when the port becomes bound before timeout', async () => {
    const port = 47711;
    setTimeout(() => {
      server = createServer();
      server.listen(port);
    }, 50);
    await expect(waitForPort(port, { timeoutMs: 2000, intervalMs: 25 })).resolves.toBeUndefined();
  });

  it('rejects with a message including the port when the timeout fires first', async () => {
    const port = 47712;
    await expect(waitForPort(port, { timeoutMs: 200, intervalMs: 25 })).rejects.toThrow(/47712/);
  });
});
