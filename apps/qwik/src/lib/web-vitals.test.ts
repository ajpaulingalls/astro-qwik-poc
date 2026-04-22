import { describe, it, expect, beforeEach, vi } from 'vitest';

const callbacks = { onLCP: undefined, onCLS: undefined, onINP: undefined } as Record<
  string,
  ((m: unknown) => void) | undefined
>;

vi.mock('web-vitals', () => ({
  onLCP: (cb: (m: unknown) => void) => {
    callbacks.onLCP = cb;
  },
  onCLS: (cb: (m: unknown) => void) => {
    callbacks.onCLS = cb;
  },
  onINP: (cb: (m: unknown) => void) => {
    callbacks.onINP = cb;
  },
}));

describe('qwik web-vitals shim', () => {
  beforeEach(() => {
    callbacks.onLCP = callbacks.onCLS = callbacks.onINP = undefined;
    delete (globalThis as unknown as { __webVitals?: unknown }).__webVitals;
    vi.resetModules();
  });

  it('initializes globalThis.__webVitals as an empty array on import', async () => {
    await import('./web-vitals.ts');
    expect((globalThis as unknown as { __webVitals: unknown }).__webVitals).toEqual([]);
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
