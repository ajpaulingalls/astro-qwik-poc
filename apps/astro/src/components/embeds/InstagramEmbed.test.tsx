// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { InstagramEmbed } from './InstagramEmbed';

const INSTAGRAM_HTML = `<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/X/"><a href="https://www.instagram.com/p/X/">View</a></blockquote>`;
const SCRIPT_SELECTOR = 'script[src*="instagram.com/embed.js"]';

declare global {
  interface Window {
    instgrm?: { Embeds?: { process?: () => void } };
  }
}

describe('InstagramEmbed', () => {
  afterEach(() => {
    cleanup();
    document.querySelectorAll(SCRIPT_SELECTOR).forEach((s) => s.remove());
    delete window.instgrm;
  });

  it('renders the provided blockquote html via dangerouslySetInnerHTML', () => {
    const { container } = render(<InstagramEmbed html={INSTAGRAM_HTML} />);
    const bq = container.querySelector('blockquote.instagram-media');
    expect(bq).toBeTruthy();
    expect(bq?.getAttribute('data-instgrm-permalink')).toBe('https://www.instagram.com/p/X/');
  });

  it('injects the instagram.com/embed.js script on mount', () => {
    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
    render(<InstagramEmbed html={INSTAGRAM_HTML} />);
    const script = document.querySelector(SCRIPT_SELECTOR);
    expect(script).toBeTruthy();
  });

  it('calls window.instgrm.Embeds.process() after the script loads', () => {
    let called = 0;
    window.instgrm = {
      Embeds: {
        process: () => {
          called++;
        },
      },
    };
    render(<InstagramEmbed html={INSTAGRAM_HTML} />);
    const script = document.querySelector(SCRIPT_SELECTOR) as HTMLScriptElement;
    script.dispatchEvent(new Event('load'));
    expect(called).toBe(1);
  });

  it('does not throw when window.instgrm is unavailable at load time', () => {
    render(<InstagramEmbed html={INSTAGRAM_HTML} />);
    const script = document.querySelector(SCRIPT_SELECTOR) as HTMLScriptElement;
    expect(() => script.dispatchEvent(new Event('load'))).not.toThrow();
  });
});
