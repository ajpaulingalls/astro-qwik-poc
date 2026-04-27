import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { InstagramEmbed } from './InstagramEmbed';

const INSTAGRAM_HTML = `<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/X/"><a href="https://www.instagram.com/p/X/">View</a></blockquote>`;

describe('InstagramEmbed', () => {
  // createDOM does not fire useVisibleTask$ — script injection is verified at
  // preview/e2e. Unit test confirms render shape.
  it('renders the provided blockquote html', async () => {
    const { screen, render } = await createDOM();
    await render(<InstagramEmbed html={INSTAGRAM_HTML} />);
    const bq = screen.querySelector('blockquote.instagram-media');
    expect(bq).toBeTruthy();
    expect(bq?.getAttribute('data-instgrm-permalink')).toBe('https://www.instagram.com/p/X/');
  });

  it('wraps the embed in a class="embed-instagram" container', async () => {
    const { screen, render } = await createDOM();
    await render(<InstagramEmbed html={INSTAGRAM_HTML} />);
    expect(screen.querySelector('div.embed-instagram')).toBeTruthy();
  });
});
