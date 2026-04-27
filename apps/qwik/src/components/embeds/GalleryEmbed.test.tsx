import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { GalleryEmbed } from './GalleryEmbed';

const GALLERY_HTML = `<div class="wp-block-gallery has-nested-images columns-3 is-cropped"><figure class="wp-block-image"><img src="/wp-content/uploads/a.jpg" alt="A"/><figcaption>A caption</figcaption></figure><figure class="wp-block-image"><img src="/wp-content/uploads/b.jpg" alt="B"/></figure></div>`;

describe('GalleryEmbed', () => {
  it('renders the wp-block-gallery div', async () => {
    const { screen, render } = await createDOM();
    await render(<GalleryEmbed html={GALLERY_HTML} />);
    const gallery = screen.querySelector('div.wp-block-gallery');
    expect(gallery).toBeTruthy();
    expect(gallery?.classList.contains('columns-3')).toBe(true);
  });

  it('renders all nested figures and images', async () => {
    const { screen, render } = await createDOM();
    await render(<GalleryEmbed html={GALLERY_HTML} />);
    const figures = screen.querySelectorAll('figure.wp-block-image');
    expect(figures.length).toBe(2);
    const imgs = screen.querySelectorAll('img');
    expect(imgs.length).toBe(2);
    expect(imgs[0].getAttribute('alt')).toBe('A');
  });

  it('wraps in a class="embed-gallery" container', async () => {
    const { screen, render } = await createDOM();
    await render(<GalleryEmbed html={GALLERY_HTML} />);
    expect(screen.querySelector('div.embed-gallery')).toBeTruthy();
  });
});
