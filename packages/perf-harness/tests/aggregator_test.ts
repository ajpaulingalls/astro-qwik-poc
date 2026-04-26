import { describe, it, expect } from 'vitest';
import { median } from '../aggregator.ts';

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
