import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { YouTubeEmbed } from './YouTubeEmbed';

const YOUTUBE_HTML = `<iframe loading="lazy" title="YouTube video player" width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ?feature=oembed" frameborder="0" allow="accelerometer" allowfullscreen></iframe>`;

describe('YouTubeEmbed', () => {
  it('renders the iframe', async () => {
    const { screen, render } = await createDOM();
    await render(<YouTubeEmbed html={YOUTUBE_HTML} />);
    const iframe = screen.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute('src')).toContain('youtube.com/embed/dQw4w9WgXcQ');
  });

  it('wraps in a class="embed-youtube" container', async () => {
    const { screen, render } = await createDOM();
    await render(<YouTubeEmbed html={YOUTUBE_HTML} />);
    expect(screen.querySelector('div.embed-youtube')).toBeTruthy();
  });

  it('does NOT inject any script tag (YouTube iframes are self-contained)', async () => {
    const { screen, render } = await createDOM();
    await render(<YouTubeEmbed html={YOUTUBE_HTML} />);
    expect(screen.querySelectorAll('script').length).toBe(0);
  });
});
