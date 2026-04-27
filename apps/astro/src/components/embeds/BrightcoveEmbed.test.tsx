// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { BrightcoveEmbed } from './BrightcoveEmbed';

const BRIGHTCOVE_HTML = `<div style="display: block;">
  <div style="padding-top: 56%;" data-bc="true">
    <video-js id="6393574500112" data-video-id="6393574500112" data-account="665003303001" data-player="6tKQRAx7lu" class="video-js" controls></video-js>
  </div>
</div>`;

const SCRIPT_PREFIX = 'https://players.brightcove.net/';

describe('BrightcoveEmbed', () => {
  afterEach(() => {
    cleanup();
    document.querySelectorAll(`script[src^="${SCRIPT_PREFIX}"]`).forEach((s) => s.remove());
  });

  it('renders the video-js element via dangerouslySetInnerHTML', () => {
    const { container } = render(<BrightcoveEmbed html={BRIGHTCOVE_HTML} />);
    const video = container.querySelector('video-js');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('data-account')).toBe('665003303001');
    expect(video?.getAttribute('data-player')).toBe('6tKQRAx7lu');
  });

  it('injects the per-account/per-player Brightcove script on mount', () => {
    render(<BrightcoveEmbed html={BRIGHTCOVE_HTML} />);
    const expected = `${SCRIPT_PREFIX}665003303001/6tKQRAx7lu_default/index.min.js`;
    const script = document.querySelector(`script[src="${expected}"]`);
    expect(script).toBeTruthy();
  });

  it('does not inject a script when video-js attrs are missing', () => {
    const malformed = '<div><video-js class="video-js"></video-js></div>';
    render(<BrightcoveEmbed html={malformed} />);
    expect(document.querySelectorAll(`script[src^="${SCRIPT_PREFIX}"]`).length).toBe(0);
  });

  it('does not duplicate the script across two BrightcoveEmbeds with the same account/player', () => {
    render(<BrightcoveEmbed html={BRIGHTCOVE_HTML} />);
    cleanup();
    render(<BrightcoveEmbed html={BRIGHTCOVE_HTML} />);
    expect(document.querySelectorAll(`script[src^="${SCRIPT_PREFIX}"]`).length).toBe(1);
  });
});
