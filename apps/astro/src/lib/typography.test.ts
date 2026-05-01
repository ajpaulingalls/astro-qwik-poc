import { describe, it, expect } from 'vitest';
import { DISPLAY_HEADLINE_CLASS } from './typography';

describe('DISPLAY_HEADLINE_CLASS', () => {
  it('declares the editorial display scale + tight rhythm + ink color', () => {
    for (const cls of [
      'text-3xl',
      'md:text-4xl',
      'font-bold',
      'leading-[1.05]',
      'tracking-tight',
      'text-neutral-900',
    ]) {
      expect(DISPLAY_HEADLINE_CLASS).toContain(cls);
    }
  });

  it('uses the editorial serif (font-serif aliased to Noto Serif Display via tokens.css)', () => {
    expect(DISPLAY_HEADLINE_CLASS).toContain('font-serif');
  });
});
