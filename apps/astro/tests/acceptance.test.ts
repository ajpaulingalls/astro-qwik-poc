// Browser acceptance tests for story-001 ACs that headless Lighthouse +
// happy-dom unit tests can't fully verify: real-browser layout at multiple
// viewports, hamburger interaction in a live page, font load.
//
// Spawns mock-api (deno) + Astro production server (deno run dist/server/entry.mjs)
// + chrome-launcher's Chrome, drives puppeteer-core. Same lifecycle pattern
// as packages/perf-harness/runner.ts so behavior is consistent.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { connect } from 'node:net';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as chromeLauncher from 'chrome-launcher';
import puppeteer, { type Browser } from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const MOCK_PORT = 4455;
const APP_PORT = 8080;
const APP_URL = `http://127.0.0.1:${APP_PORT}/`;

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

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const reached = await new Promise<boolean>((res) => {
      const sock = connect({ port, host: '127.0.0.1' });
      sock.once('connect', () => {
        sock.end();
        res(true);
      });
      sock.once('error', () => res(false));
    });
    if (reached) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`waitForPort: port ${port} timed out (${timeoutMs}ms)`);
}

async function killProc(proc: ChildProcess): Promise<void> {
  if (proc.exitCode !== null) return;
  await new Promise<void>((res) => {
    const t = setTimeout(() => proc.kill('SIGKILL'), 2000);
    proc.once('exit', () => {
      clearTimeout(t);
      res();
    });
    proc.kill('SIGTERM');
  });
}

describe('astro homepage acceptance', () => {
  let mockApi: ChildProcess;
  let astroApp: ChildProcess;
  let chrome: chromeLauncher.LaunchedChrome;
  let browser: Browser;

  beforeAll(async () => {
    mockApi = spawn(
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
    astroApp = spawn(
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
    await Promise.all([waitForPort(MOCK_PORT, 10_000), waitForPort(APP_PORT, 60_000)]);
    chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless=new', '--no-sandbox'],
    });
    browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${chrome.port}`,
    });
  }, 90_000);

  afterAll(async () => {
    await browser?.disconnect();
    await chrome?.kill();
    await Promise.all([astroApp, mockApi].map(killProc));
  });

  it('renders nav + main + footer at mobile viewport (320×568)', async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 320, height: 568 });
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30_000 });
    const present = await page.evaluate(() => ({
      nav: !!document.querySelector('nav'),
      main: !!document.querySelector('main'),
      footer: !!document.querySelector('footer'),
      hamburger: !!document.querySelector('button[aria-label="Menu"]'),
    }));
    expect(present.nav).toBe(true);
    expect(present.main).toBe(true);
    expect(present.footer).toBe(true);
    expect(present.hamburger).toBe(true);
    await page.close();
  });

  it('renders nav + main + footer at desktop viewport (1280×800)', async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30_000 });
    const counts = await page.evaluate(() => ({
      nav: !!document.querySelector('nav'),
      main: !!document.querySelector('main'),
      footer: !!document.querySelector('footer'),
      navLinks: document.querySelectorAll('nav ul a').length,
    }));
    expect(counts.nav).toBe(true);
    expect(counts.main).toBe(true);
    expect(counts.footer).toBe(true);
    expect(counts.navLinks).toBe(7);
    await page.close();
  });

  it('hamburger toggle works in a live browser (mobile viewport)', async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 320, height: 568 });
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30_000 });
    // NavigationMenu is client:idle — wait for it to hydrate before clicking.
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('button[aria-label="Menu"]');
        return !!btn && btn.getAttribute('aria-expanded') === 'false';
      },
      { timeout: 10_000 },
    );
    const before = await page.$eval('button[aria-label="Menu"]', (b) =>
      b.getAttribute('aria-expanded'),
    );
    expect(before).toBe('false');
    await page.click('button[aria-label="Menu"]');
    await page.waitForFunction(
      () =>
        document.querySelector('button[aria-label="Menu"]')?.getAttribute('aria-expanded') ===
        'true',
      { timeout: 5_000 },
    );
    const ulVisibleAfterClick = await page.$eval(
      'nav ul',
      (el) => el.className.includes('flex') && !el.className.includes('hidden'),
    );
    expect(ulVisibleAfterClick).toBe(true);
    await page.close();
  });

  it('Inter web font is loaded with no CLS-triggering FOIT', async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    const fontInfo = await page.evaluate(() => {
      const loaded: string[] = [];
      for (const f of document.fonts) {
        if (f.status === 'loaded') loaded.push(f.family);
      }
      const h1 = document.querySelector('h1');
      const computed = h1 ? getComputedStyle(h1).fontFamily : '';
      return { loaded, computed };
    });
    expect(fontInfo.loaded.some((f) => /Inter/i.test(f))).toBe(true);
    expect(fontInfo.computed).toMatch(/Inter|--font-inter/);
    await page.close();
  });
});
