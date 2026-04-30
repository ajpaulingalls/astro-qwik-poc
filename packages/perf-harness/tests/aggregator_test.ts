import { describe, it, expect } from 'vitest';
import { median, percentile } from '../aggregator.ts';

describe('median', () => {
  it('throws on empty input', () => {
    expect(() => median([])).toThrow(/empty/i);
  });

  it('returns the only sample for n=1', () => {
    expect(median([42])).toBe(42);
  });

  it('returns the middle sample for odd n', () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
  });

  it('returns mean of two middles for even n (standard definition)', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([10, 20])).toBe(15);
  });

  it('handles unsorted input', () => {
    expect(median([5, 1, 4, 2, 3])).toBe(3);
  });

  it('does not mutate the input array', () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe('percentile', () => {
  it('throws on empty input', () => {
    expect(() => percentile([], 0.95)).toThrow(/empty/i);
  });

  it('rejects p < 0', () => {
    expect(() => percentile([1, 2, 3], -0.01)).toThrow(/p must be in \[0, 1\]/);
  });

  it('rejects p > 1', () => {
    expect(() => percentile([1, 2, 3], 1.01)).toThrow(/p must be in \[0, 1\]/);
  });

  it('rejects p = NaN', () => {
    expect(() => percentile([1, 2, 3], Number.NaN)).toThrow(/p must be in \[0, 1\]/);
  });

  it('returns the smallest sample at p=0', () => {
    expect(percentile([10, 20, 30, 40, 50], 0)).toBe(10);
  });

  it('returns the largest sample at p=1', () => {
    expect(percentile([10, 20, 30, 40, 50], 1)).toBe(50);
  });

  it('matches median() at p=0.5 for odd n (invariant)', () => {
    const samples = [1, 2, 3, 4, 5];
    expect(percentile(samples, 0.5)).toBe(median(samples));
    expect(percentile(samples, 0.5)).toBe(3);
  });

  it('matches median() at p=0.5 for even n (invariant)', () => {
    const samples = [1, 2, 3, 4];
    expect(percentile(samples, 0.5)).toBe(median(samples));
    expect(percentile(samples, 0.5)).toBe(2.5);
  });

  it('interpolates p=0.95 for n=10 (rank = 8.55)', () => {
    // sorted [1..10]: result = sorted[8] + 0.55 * (sorted[9] - sorted[8]) = 9 + 0.55 = 9.55
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBeCloseTo(9.55, 10);
  });

  it('interpolates p=0.95 for n=20 (rank = 18.05)', () => {
    // sorted [1..20]: result = sorted[18] + 0.05 * (sorted[19] - sorted[18]) = 19.05
    const samples = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(percentile(samples, 0.95)).toBeCloseTo(19.05, 10);
  });

  it('does not mutate the input array', () => {
    const input = [3, 1, 2];
    percentile(input, 0.95);
    expect(input).toEqual([3, 1, 2]);
  });
});
