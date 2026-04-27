import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { LeadImage } from './LeadImage';
import { resizedImageUrl, resolveImageUrl } from '../lib/image-url';
import type { HomepageImage } from '@aje-poc/shared-types';

const image: HomepageImage = {
  sourceUrl: '/wp-content/uploads/2026/04/oil.jpg',
  alt: 'Oil spill at Tuapse',
  width: 1200,
  height: 800,
};

describe('LeadImage', () => {
  it('emits srcset with default widths [400, 800, 1200] using resizedImageUrl', async () => {
    const { screen, render } = await createDOM();
    await render(<LeadImage image={image} priority="eager" />);
    const img = screen.querySelector('img')!;
    const srcset = img.getAttribute('srcset')!;
    const ratio = image.height! / image.width!;
    const expected = [400, 800, 1200]
      .map(
        (w) =>
          `${resizedImageUrl(image.sourceUrl, { width: w, height: Math.round(w * ratio) })} ${w}w`,
      )
      .join(', ');
    expect(srcset).toBe(expected);
  });

  it('honors caller-supplied widths prop and rebuilds srcset', async () => {
    const { screen, render } = await createDOM();
    await render(<LeadImage image={image} priority="lazy" widths={[300, 600]} />);
    const srcset = screen.querySelector('img')!.getAttribute('srcset')!;
    expect(srcset).toContain('?w=300&resize=300%2C200');
    expect(srcset).toContain('?w=600&resize=600%2C400');
    expect(srcset).not.toContain('?w=400');
  });

  it('honors caller-supplied sizes prop (default 100vw if omitted)', async () => {
    const { screen: s1, render: r1 } = await createDOM();
    await r1(<LeadImage image={image} priority="eager" sizes="(min-width: 768px) 768px, 100vw" />);
    expect(s1.querySelector('img')!.getAttribute('sizes')).toBe('(min-width: 768px) 768px, 100vw');

    const { screen: s2, render: r2 } = await createDOM();
    await r2(<LeadImage image={image} priority="lazy" />);
    expect(s2.querySelector('img')!.getAttribute('sizes')).toBe('100vw');
  });

  it('emits eager loading + fetchpriority=high + decoding=async on the LCP path', async () => {
    const { screen, render } = await createDOM();
    await render(<LeadImage image={image} priority="eager" />);
    const img = screen.querySelector('img')!;
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
    expect(img.getAttribute('decoding')).toBe('async');
  });

  it('emits lazy loading without fetchpriority on the lazy path', async () => {
    const { screen, render } = await createDOM();
    await render(<LeadImage image={image} priority="lazy" />);
    const img = screen.querySelector('img')!;
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.hasAttribute('fetchpriority')).toBe(false);
  });

  it('src fallback uses resolveImageUrl on the original (browsers without srcset support)', async () => {
    const { screen, render } = await createDOM();
    await render(<LeadImage image={image} priority="eager" />);
    expect(screen.querySelector('img')!.getAttribute('src')).toBe(resolveImageUrl(image.sourceUrl));
  });

  it('does NOT add aspect-[3/2] or object-cover (intrinsic dims drive layout now)', async () => {
    const { screen, render } = await createDOM();
    await render(<LeadImage image={image} priority="eager" />);
    const img = screen.querySelector('img')!;
    const cls = img.getAttribute('class') ?? '';
    expect(cls).not.toContain('aspect-[3/2]');
    expect(cls).not.toContain('object-cover');
    expect(img.getAttribute('width')).toBe('1200');
    expect(img.getAttribute('height')).toBe('800');
  });

  it('omits srcset when image has no width/height (no silent square-aspect lie)', async () => {
    const { screen, render } = await createDOM();
    await render(<LeadImage image={{ sourceUrl: '/wp-content/uploads/x.jpg' }} priority="lazy" />);
    expect(screen.querySelector('img')!.hasAttribute('srcset')).toBe(false);
  });

  it('extraClass is prepended to the canonical class set', async () => {
    const { screen, render } = await createDOM();
    await render(<LeadImage image={image} priority="eager" extraClass="lead-image my-4" />);
    const cls = screen.querySelector('img')!.getAttribute('class') ?? '';
    expect(cls).toContain('lead-image');
    expect(cls).toContain('my-4');
    expect(cls).toContain('w-full');
    expect(cls).toContain('h-auto');
    expect(cls).toContain('rounded');
  });
});
