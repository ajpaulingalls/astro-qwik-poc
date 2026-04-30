import { describe, it, expect, beforeEach, vi } from 'vitest';

const callbacks = { onLCP: undefined, onCLS: undefined, onINP: undefined } as Record<
  string,
  ((m: unknown) => void) | undefined
>;
const opts = { onLCP: undefined, onCLS: undefined, onINP: undefined } as Record<
  string,
  Record<string, unknown> | undefined
>;

vi.mock('web-vitals', () => ({
  onLCP: (cb: (m: unknown) => void, o?: Record<string, unknown>) => {
    callbacks.onLCP = cb;
    opts.onLCP = o;
  },
  onCLS: (cb: (m: unknown) => void, o?: Record<string, unknown>) => {
    callbacks.onCLS = cb;
    opts.onCLS = o;
  },
  onINP: (cb: (m: unknown) => void, o?: Record<string, unknown>) => {
    callbacks.onINP = cb;
    opts.onINP = o;
  },
}));

describe('qwik web-vitals shim', () => {
  beforeEach(() => {
    callbacks.onLCP = callbacks.onCLS = callbacks.onINP = undefined;
    opts.onLCP = opts.onCLS = opts.onINP = undefined;
    delete (globalThis as unknown as { __webVitals?: unknown }).__webVitals;
    vi.resetModules();
  });

  it('initializes globalThis.__webVitals as an empty array on import', async () => {
    await import('./web-vitals.ts');
    expect((globalThis as unknown as { __webVitals: unknown }).__webVitals).toEqual([]);
  });

  it('passes durationThreshold:0 to onINP so the perf-harness Tab-press probe is captured', async () => {
    // The web-vitals lib defaults to durationThreshold:40 — events shorter
    // than 40ms (e.g. a perf-harness keyboard.press('Tab') with no handler)
    // are dropped, which means INP never fires and the harness times out.
    // Set 0 to capture every interaction; production accuracy improves anyway.
    await import('./web-vitals.ts');
    expect(opts.onINP).toBeDefined();
    expect(opts.onINP!.durationThreshold).toBe(0);
  });

  it('subscribes to onLCP, onCLS, onINP with callbacks that push samples', async () => {
    await import('./web-vitals.ts');
    expect(typeof callbacks.onLCP).toBe('function');
    expect(typeof callbacks.onCLS).toBe('function');
    expect(typeof callbacks.onINP).toBe('function');

    callbacks.onLCP!({ name: 'LCP', value: 1234 });
    callbacks.onCLS!({ name: 'CLS', value: 0.01 });
    callbacks.onINP!({ name: 'INP', value: 42 });

    const samples = (globalThis as unknown as { __webVitals: unknown[] }).__webVitals;
    expect(samples).toHaveLength(3);
    expect(samples[0]).toEqual({ name: 'LCP', value: 1234 });
    expect(samples[1]).toEqual({ name: 'CLS', value: 0.01 });
    expect(samples[2]).toEqual({ name: 'INP', value: 42 });
  });
});
