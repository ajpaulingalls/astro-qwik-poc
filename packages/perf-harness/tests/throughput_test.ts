import { describe, it, expect } from 'vitest';
import { parseDuration } from '../throughput.ts';

describe('parseDuration', () => {
  it('parses seconds suffix', () => {
    expect(parseDuration('10s')).toBe(10_000);
    expect(parseDuration('2s')).toBe(2_000);
    expect(parseDuration('1s')).toBe(1_000);
  });

  it('parses milliseconds suffix', () => {
    expect(parseDuration('500ms')).toBe(500);
    expect(parseDuration('1ms')).toBe(1);
  });

  it('rejects empty string', () => {
    expect(() => parseDuration('')).toThrow(/duration/i);
  });

  it('rejects bare numbers without unit', () => {
    expect(() => parseDuration('10')).toThrow(/duration/i);
  });

  it('rejects unknown unit', () => {
    expect(() => parseDuration('10x')).toThrow(/duration/i);
  });

  it('rejects negative values', () => {
    expect(() => parseDuration('-5s')).toThrow(/duration/i);
  });

  it('rejects zero', () => {
    expect(() => parseDuration('0s')).toThrow(/duration/i);
  });
});
