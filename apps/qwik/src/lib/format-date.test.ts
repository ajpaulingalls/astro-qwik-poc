import { describe, it, expect } from 'vitest';
import { formatDate } from './format-date';

describe('formatDate', () => {
  it('formats a valid ISO 8601 timestamp in en-GB long style', () => {
    expect(formatDate('2026-04-24T16:52:48')).toBe('24 April 2026');
  });

  it('throws with the input value when the date is unparseable', () => {
    expect(() => formatDate('not-a-date')).toThrow(/not-a-date/);
  });

  it('throws when the input is empty string', () => {
    expect(() => formatDate('')).toThrow(/unparseable date/);
  });
});
