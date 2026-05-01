// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { YouTubeEmbed } from './YouTubeEmbed';

const YOUTUBE_HTML = `<iframe loading="lazy" title="YouTube video player" width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ?feature=oembed" frameborder="0" allow="accelerometer" allowfullscreen></iframe>`;

describe('YouTubeEmbed', () => {
  afterEach(cleanup);

  it('renders the iframe via dangerouslySetInnerHTML', () => {
    const { container } = render(<YouTubeEmbed html={YOUTUBE_HTML} />);
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute('src')).toContain('youtube.com/embed/dQw4w9WgXcQ');
  });

  it('wraps in a class="embed-youtube" container', () => {
    const { container } = render(<YouTubeEmbed html={YOUTUBE_HTML} />);
    expect(container.querySelector('div.embed-youtube')).toBeTruthy();
  });

  it('does NOT inject any script tag (YouTube iframes are self-contained)', () => {
    expect(document.querySelectorAll('script').length).toBe(0);
    render(<YouTubeEmbed html={YOUTUBE_HTML} />);
    expect(document.querySelectorAll('script').length).toBe(0);
  });

  it('strips inline style attributes (CSP style-src-attr defense)', () => {
    const styledHtml =
      '<div style="position:relative;padding-bottom:56.25%"><iframe src="https://youtube.com/embed/x"></iframe></div>';
    const { container } = render(<YouTubeEmbed html={styledHtml} />);
    expect(container.querySelectorAll('[style]').length).toBe(0);
  });
});
