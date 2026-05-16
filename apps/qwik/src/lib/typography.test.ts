import { describe, it, expect } from 'vitest';
import { DISPLAY_HEADLINE_CLASS } from './typography';

describe('DISPLAY_HEADLINE_CLASS', () => {
  it('is the canonical editorial-display class string', () => {
    expect(DISPLAY_HEADLINE_CLASS).toBe(
      'text-3xl md:text-4xl font-bold leading-[1.05] tracking-tight text-neutral-900',
    );
  });
});
