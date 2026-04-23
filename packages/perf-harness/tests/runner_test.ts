import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = resolve(__dirname, '../reports');
const TARGET = 'astro';
const PAGE = 'index';

const { spawnMock, runLighthouseAuditMock, withChromeMock, collectWebVitalsMock, waitForPortMock } =
  vi.hoisted(() => ({
    spawnMock: vi.fn(() => {
      const listeners: Record<string, Array<(...a: unknown[]) => void>> = {};
      const proc = {
        exitCode: null as number | null,
        kill: vi.fn(() => {
          proc.exitCode = 0;
          for (const cb of listeners.exit ?? []) cb(0);
        }),
        once: vi.fn((event: string, cb: (...a: unknown[]) => void) => {
          listeners[event] = (listeners[event] ?? []).concat(cb);
        }),
      };
      return proc;
    }),
    runLighthouseAuditMock: vi.fn(),
    withChromeMock: vi.fn(<T>(fn: (port: number) => Promise<T>) => fn(12345)),
    collectWebVitalsMock: vi.fn(),
    waitForPortMock: vi.fn(async () => undefined),
  }));

vi.mock('node:child_process', () => ({ spawn: spawnMock }));
vi.mock('../lighthouse.ts', () => ({ runLighthouseAudit: runLighthouseAuditMock }));
vi.mock('../chrome.ts', () => ({ withChrome: withChromeMock }));
vi.mock('../web_vitals_collector.ts', () => ({ collectWebVitals: collectWebVitalsMock }));
vi.mock('../cli_helpers.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../cli_helpers.ts')>();
  return { ...actual, waitForPort: waitForPortMock };
});

import { main } from '../runner.ts';

const ASTRO_REPORT_JSON = resolve(REPORTS_DIR, `${TARGET}-${PAGE}.json`);
const ASTRO_REPORT_MD = resolve(REPORTS_DIR, `${TARGET}-${PAGE}.md`);
const QWIK_REPORT_JSON = resolve(REPORTS_DIR, `qwik-${PAGE}.json`);
const QWIK_REPORT_MD = resolve(REPORTS_DIR, `qwik-${PAGE}.md`);

function cleanupAstroReports() {
  for (const p of [ASTRO_REPORT_JSON, ASTRO_REPORT_MD, QWIK_REPORT_JSON, QWIK_REPORT_MD]) {
    if (existsSync(p)) rmSync(p);
  }
}

function spawnedProcs() {
  return spawnMock.mock.results.map((r) => r.value);
}

describe('runner main()', () => {
  beforeEach(() => {
    spawnMock.mockClear();
    runLighthouseAuditMock.mockReset();
    withChromeMock.mockClear();
    collectWebVitalsMock.mockReset();
    waitForPortMock.mockClear();
    cleanupAstroReports();
  });
  afterEach(() => {
    cleanupAstroReports();
  });

  it('writes JSON+MD reports for astro/index with aggregated n=2 metrics', async () => {
    runLighthouseAuditMock.mockResolvedValue({ lcp: 900, cls: 0, lhPerf: 100, jsBytes: 0 });
    collectWebVitalsMock.mockResolvedValue([{ name: 'LCP', value: 900, id: 'x' }]);

    await main([`--target=${TARGET}`, '--runs=2', `--page=${PAGE}`]);

    expect(existsSync(ASTRO_REPORT_JSON)).toBe(true);
    expect(existsSync(ASTRO_REPORT_MD)).toBe(true);

    const json = JSON.parse(readFileSync(ASTRO_REPORT_JSON, 'utf8'));
    expect(json.page).toBe(PAGE);
    expect(json.target).toBe(TARGET);
    expect(json.metrics.lcp).toEqual({ median: 900, n: 2 });
    expect(json.metrics.cls.n).toBe(2);
    expect(json.webVitals.samples).toHaveLength(2);

    const md = readFileSync(ASTRO_REPORT_MD, 'utf8');
    expect(md).toContain(`${TARGET}/${PAGE}`);
  });

  it('runs Lighthouse + collectWebVitals exactly --runs times', async () => {
    runLighthouseAuditMock.mockResolvedValue({ lcp: 1000, cls: 0, lhPerf: 99, jsBytes: 100 });
    collectWebVitalsMock.mockResolvedValue([]);

    await main([`--target=${TARGET}`, '--runs=3', `--page=${PAGE}`]);

    expect(runLighthouseAuditMock).toHaveBeenCalledTimes(3);
    expect(collectWebVitalsMock).toHaveBeenCalledTimes(3);
  });

  it('spawns qwik via node + server.ts with HOST/PORT env in apps/qwik cwd', async () => {
    runLighthouseAuditMock.mockResolvedValue({ lcp: 1000, cls: 0, lhPerf: 99, jsBytes: 100 });
    collectWebVitalsMock.mockResolvedValue([]);

    await main(['--target=qwik', '--runs=1', `--page=${PAGE}`]);

    // First spawn = mock-api (deno); second = qwik target.
    expect(spawnMock).toHaveBeenCalledTimes(2);
    const [cmd, args, opts] = spawnMock.mock.calls[1] as [
      string,
      readonly string[],
      { cwd?: string; env?: Record<string, string> },
    ];
    expect(cmd).toBe('node');
    expect(args).toContain('server.ts');
    expect(args).toContain('--experimental-strip-types');
    expect(opts.env).toMatchObject({ HOST: '127.0.0.1', PORT: '4173' });
    expect(opts.cwd).toMatch(/apps\/qwik$/);
  });

  it('kills both spawned services when the page loop throws', async () => {
    runLighthouseAuditMock
      .mockResolvedValueOnce({ lcp: 1000, cls: 0, lhPerf: 99, jsBytes: 100 })
      .mockRejectedValueOnce(new Error('lighthouse blew up'));
    collectWebVitalsMock.mockResolvedValue([]);

    await expect(main([`--target=${TARGET}`, '--runs=2', `--page=${PAGE}`])).rejects.toThrow(
      /lighthouse blew up/,
    );

    // spawnMockApi + spawnAstro = 2 services spawned
    const procs = spawnedProcs();
    expect(procs).toHaveLength(2);
    for (const proc of procs) {
      expect(proc.kill).toHaveBeenCalled();
    }
  });
});
