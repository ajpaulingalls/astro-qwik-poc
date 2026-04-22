import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:net';
import { buildPageList, parseArgs, waitForPort } from '../runner_helpers.ts';

describe('parseArgs', () => {
  it('parses --target=astro with default runs=5', () => {
    expect(parseArgs(['--target=astro'])).toEqual({ target: 'astro', runs: 5 });
  });

  it('parses --target=qwik with --runs=10', () => {
    expect(parseArgs(['--target=qwik', '--runs=10'])).toEqual({ target: 'qwik', runs: 10 });
  });

  it('parses --page=home filter', () => {
    expect(parseArgs(['--target=astro', '--page=home'])).toEqual({
      target: 'astro',
      runs: 5,
      page: 'home',
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
    expect(pages.find((p) => p.name === 'home')).toBeDefined();
  });

  it('returns at least one page for qwik', () => {
    const pages = buildPageList('qwik');
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages.find((p) => p.name === 'home')).toBeDefined();
  });

  it('every page has a path starting with /', () => {
    for (const target of ['astro', 'qwik'] as const) {
      for (const page of buildPageList(target)) {
        expect(page.path.startsWith('/')).toBe(true);
      }
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
