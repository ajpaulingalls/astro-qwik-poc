// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { TwitterEmbed } from './TwitterEmbed';

const TWITTER_HTML = `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Deadlock over.</p></blockquote>`;
const SCRIPT_SELECTOR = 'script[src*="platform.twitter.com/widgets.js"]';

describe('TwitterEmbed', () => {
  afterEach(() => {
    cleanup();
    document.querySelectorAll(SCRIPT_SELECTOR).forEach((s) => s.remove());
  });

  it('renders the provided blockquote html via dangerouslySetInnerHTML', () => {
    const { container } = render(<TwitterEmbed html={TWITTER_HTML} />);
    const bq = container.querySelector('blockquote.twitter-tweet');
    expect(bq).toBeTruthy();
    expect(bq?.textContent).toContain('Deadlock over');
  });

  it('injects the platform.twitter.com widgets script on mount', () => {
    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
    render(<TwitterEmbed html={TWITTER_HTML} />);
    const script = document.querySelector(SCRIPT_SELECTOR);
    expect(script).toBeTruthy();
    expect(script?.getAttribute('async')).not.toBeNull();
  });

  it('does not duplicate the script when rendered twice (idempotent)', () => {
    render(<TwitterEmbed html={TWITTER_HTML} />);
    cleanup();
    render(<TwitterEmbed html={TWITTER_HTML} />);
    expect(document.querySelectorAll(SCRIPT_SELECTOR).length).toBe(1);
  });
});
