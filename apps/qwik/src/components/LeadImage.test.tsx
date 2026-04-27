import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import type { JSXOutput } from '@qwik.dev/core';
import { LeadImage } from './LeadImage';
import { resizedImageUrl, resolveImageUrl } from '../lib/image-url';
import type { HomepageImage } from '@aje-poc/shared-types';

const image: HomepageImage = {
  sourceUrl: '/wp-content/uploads/2026/04/oil.jpg',
  alt: 'Oil spill at Tuapse',
  width: 1200,
  height: 800,
};

// Tightens away the createDOM boilerplate so each test reads as one assertion
// against a rendered <img>. Reduces copy-paste drift between branches.
async function renderImg(jsx: JSXOutput): Promise<HTMLImageElement> {
  const { screen, render } = await createDOM();
  await render(jsx);
  return screen.querySelector('img') as HTMLImageElement;
}

describe('LeadImage', () => {
  it('emits srcset with default widths [400, 800, 1200] using resizedImageUrl', async () => {
    const img = await renderImg(<LeadImage image={image} priority="eager" />);
    const ratio = image.height! / image.width!;
    const expected = [400, 800, 1200]
      .map(
        (w) =>
          `${resizedImageUrl(image.sourceUrl, { width: w, height: Math.round(w * ratio) })} ${w}w`,
      )
      .join(', ');
    expect(img.getAttribute('srcset')).toBe(expected);
  });

  it('honors caller-supplied widths prop and rebuilds srcset', async () => {
    const img = await renderImg(<LeadImage image={image} priority="lazy" widths={[300, 600]} />);
    const srcset = img.getAttribute('srcset')!;
    expect(srcset).toContain('?w=300&resize=300%2C200');
    expect(srcset).toContain('?w=600&resize=600%2C400');
    expect(srcset).not.toContain('?w=400');
  });

  it('honors caller-supplied sizes prop (default 100vw if omitted)', async () => {
    const explicit = await renderImg(
      <LeadImage image={image} priority="eager" sizes="(min-width: 768px) 768px, 100vw" />,
    );
    expect(explicit.getAttribute('sizes')).toBe('(min-width: 768px) 768px, 100vw');

    const defaulted = await renderImg(<LeadImage image={image} priority="lazy" />);
    expect(defaulted.getAttribute('sizes')).toBe('100vw');
  });

  it('emits eager loading + fetchpriority=high + decoding=async on the LCP path', async () => {
    const img = await renderImg(<LeadImage image={image} priority="eager" />);
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
    expect(img.getAttribute('decoding')).toBe('async');
  });

  it('emits lazy loading without fetchpriority on the lazy path', async () => {
    const img = await renderImg(<LeadImage image={image} priority="lazy" />);
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.hasAttribute('fetchpriority')).toBe(false);
  });

  it('src fallback uses resolveImageUrl on the original (browsers without srcset support)', async () => {
    const img = await renderImg(<LeadImage image={image} priority="eager" />);
    expect(img.getAttribute('src')).toBe(resolveImageUrl(image.sourceUrl));
  });

  it('does NOT add aspect-[3/2] or object-cover (intrinsic dims drive layout now)', async () => {
    const img = await renderImg(<LeadImage image={image} priority="eager" />);
    const cls = img.getAttribute('class') ?? '';
    expect(cls).not.toContain('aspect-[3/2]');
    expect(cls).not.toContain('object-cover');
    expect(img.getAttribute('width')).toBe('1200');
    expect(img.getAttribute('height')).toBe('800');
  });

  it('omits srcset when image has no width/height (no silent square-aspect lie)', async () => {
    const img = await renderImg(
      <LeadImage image={{ sourceUrl: '/wp-content/uploads/x.jpg' }} priority="lazy" />,
    );
    expect(img.hasAttribute('srcset')).toBe(false);
  });

  it('renders a <figcaption> with the caption text when image.caption is present', async () => {
    const captioned: HomepageImage = { ...image, caption: 'Tuapse refinery on fire [Reuters]' };
    const { screen, render } = await createDOM();
    await render(<LeadImage image={captioned} priority="eager" />);
    const figure = screen.querySelector('figure');
    expect(figure).toBeTruthy();
    const caption = figure!.querySelector('figcaption');
    expect(caption).toBeTruthy();
    expect(caption!.textContent).toBe('Tuapse refinery on fire [Reuters]');
    expect(figure!.querySelector('img')).toBeTruthy();
  });

  it('does NOT wrap in a <figure> when image.caption is absent (no DOM regression)', async () => {
    const { screen, render } = await createDOM();
    await render(<LeadImage image={image} priority="eager" />);
    expect(screen.querySelector('figure')).toBeFalsy();
    expect(screen.querySelector('figcaption')).toBeFalsy();
    expect(screen.querySelector('img')).toBeTruthy();
  });

  it('extraClass is prepended to the canonical class set', async () => {
    const img = await renderImg(
      <LeadImage image={image} priority="eager" extraClass="lead-image my-4" />,
    );
    const cls = img.getAttribute('class') ?? '';
    expect(cls).toContain('lead-image');
    expect(cls).toContain('my-4');
    expect(cls).toContain('w-full');
    expect(cls).toContain('h-auto');
    expect(cls).toContain('rounded');
  });
});
