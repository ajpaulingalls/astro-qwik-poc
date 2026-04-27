import { describe, it, expect } from 'vitest';
import { getSectionType, GEOGRAPHIC_SECTIONS } from './section-type';

describe('getSectionType', () => {
  it('classifies known geographic slugs as geographic', () => {
    expect(getSectionType('middle-east')).toBe('geographic');
    expect(getSectionType('asia-pacific')).toBe('geographic');
    expect(getSectionType('us-canada')).toBe('geographic');
    expect(getSectionType('europe')).toBe('geographic');
    expect(getSectionType('africa')).toBe('geographic');
    expect(getSectionType('latin-america')).toBe('geographic');
  });

  it('classifies a known topic slug as topic', () => {
    expect(getSectionType('opinion')).toBe('topic');
  });

  it('classifies unknown slugs as topic (allowlist miss → topic; 404 happens at fetch time)', () => {
    expect(getSectionType('unknown-xyz')).toBe('topic');
  });

  it('classifies the empty string as topic', () => {
    expect(getSectionType('')).toBe('topic');
  });
});

describe('GEOGRAPHIC_SECTIONS', () => {
  it('matches the production allowlist (apps/astro/docs/ARCHITECTURE.md §Section Type Resolution)', () => {
    expect([...GEOGRAPHIC_SECTIONS]).toEqual([
      'middle-east',
      'asia-pacific',
      'us-canada',
      'europe',
      'africa',
      'latin-america',
    ]);
  });
});
