import { describe, expect, it } from 'vitest';
import { resolvePollIntervalMs } from './index';

describe('resolvePollIntervalMs', () => {
  it('returns the env value when finite and positive', () => {
    expect(resolvePollIntervalMs('500', 30_000)).toBe(500);
    expect(resolvePollIntervalMs(1234, 30_000)).toBe(1234);
  });
  it('falls through to default on undefined / null / empty', () => {
    expect(resolvePollIntervalMs(undefined, 30_000)).toBe(30_000);
    expect(resolvePollIntervalMs(null, 30_000)).toBe(30_000);
    expect(resolvePollIntervalMs('', 30_000)).toBe(30_000);
  });
  it('falls through to default on zero, negatives, and non-numeric strings', () => {
    expect(resolvePollIntervalMs(0, 30_000)).toBe(30_000);
    expect(resolvePollIntervalMs('-1', 30_000)).toBe(30_000);
    expect(resolvePollIntervalMs('not-a-number', 30_000)).toBe(30_000);
  });
  // Pins the Number.isFinite half of the rule. Without this, dropping
  // isFinite from the impl (using only `n > 0`) would silently let
  // Infinity through and arm setInterval with a non-finite delay.
  it('falls through to default on NaN, Infinity, and -Infinity', () => {
    expect(resolvePollIntervalMs(NaN, 30_000)).toBe(30_000);
    expect(resolvePollIntervalMs(Infinity, 30_000)).toBe(30_000);
    expect(resolvePollIntervalMs(-Infinity, 30_000)).toBe(30_000);
  });
});
