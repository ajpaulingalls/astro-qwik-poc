// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { GalleryEmbed } from './GalleryEmbed';

const GALLERY_HTML = `<div class="wp-block-gallery has-nested-images columns-3 is-cropped"><figure class="wp-block-image"><img src="/wp-content/uploads/a.jpg" alt="A"/><figcaption>A caption</figcaption></figure><figure class="wp-block-image"><img src="/wp-content/uploads/b.jpg" alt="B"/></figure></div>`;

describe('GalleryEmbed', () => {
  afterEach(cleanup);

  it('renders the wp-block-gallery div via dangerouslySetInnerHTML', () => {
    const { container } = render(<GalleryEmbed html={GALLERY_HTML} />);
    const gallery = container.querySelector('div.wp-block-gallery');
    expect(gallery).toBeTruthy();
    expect(gallery?.classList.contains('columns-3')).toBe(true);
  });

  it('renders all nested figures and images', () => {
    const { container } = render(<GalleryEmbed html={GALLERY_HTML} />);
    const figures = container.querySelectorAll('figure.wp-block-image');
    expect(figures.length).toBe(2);
    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBe(2);
    expect(imgs[0].getAttribute('alt')).toBe('A');
  });

  it('does NOT inject any script tag (no provider script for gallery)', () => {
    expect(document.querySelectorAll('script').length).toBe(0);
    render(<GalleryEmbed html={GALLERY_HTML} />);
    expect(document.querySelectorAll('script').length).toBe(0);
  });

  it('strips inline style attributes (CSP style-src-attr defense)', () => {
    // Pin the stripInlineStyles wiring — without this assertion, removing
    // the call from GalleryEmbed.tsx would leave the other tests green
    // but reintroduce the M1-observed CSP violation.
    const styledHtml = '<div class="wp-block-gallery"><figure style="width: 50%"></figure></div>';
    const { container } = render(<GalleryEmbed html={styledHtml} />);
    expect(container.querySelectorAll('[style]').length).toBe(0);
  });
});
