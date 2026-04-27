import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { BrightcoveEmbed } from './BrightcoveEmbed';

const BRIGHTCOVE_HTML = `<div style="display: block;">
  <div style="padding-top: 56%;" data-bc="true">
    <video-js id="6393574500112" data-video-id="6393574500112" data-account="665003303001" data-player="6tKQRAx7lu" class="video-js" controls></video-js>
  </div>
</div>`;

describe('BrightcoveEmbed', () => {
  it('renders the video-js element', async () => {
    const { screen, render } = await createDOM();
    await render(<BrightcoveEmbed html={BRIGHTCOVE_HTML} />);
    const video = screen.querySelector('video-js');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('data-account')).toBe('665003303001');
    expect(video?.getAttribute('data-player')).toBe('6tKQRAx7lu');
  });

  it('wraps in a class="embed-brightcove" container', async () => {
    const { screen, render } = await createDOM();
    await render(<BrightcoveEmbed html={BRIGHTCOVE_HTML} />);
    expect(screen.querySelector('div.embed-brightcove')).toBeTruthy();
  });
});
