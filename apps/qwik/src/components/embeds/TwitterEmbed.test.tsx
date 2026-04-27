import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { TwitterEmbed } from './TwitterEmbed';

const TWITTER_HTML = `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Deadlock over.</p></blockquote>`;

describe('TwitterEmbed', () => {
  // NOTE: createDOM does not bootstrap qwikLoader, so useVisibleTask$ does not
  // fire and script injection is not exercised here. Verified at e2e/preview
  // time. The injectEmbedScript helper is unit-tested directly in
  // inject-embed-script.test.ts.
  it('renders the provided blockquote html', async () => {
    const { screen, render } = await createDOM();
    await render(<TwitterEmbed html={TWITTER_HTML} />);
    const bq = screen.querySelector('blockquote.twitter-tweet');
    expect(bq).toBeTruthy();
    expect(bq?.textContent).toContain('Deadlock over');
  });

  it('wraps the embed in a class="embed-twitter" container', async () => {
    const { screen, render } = await createDOM();
    await render(<TwitterEmbed html={TWITTER_HTML} />);
    expect(screen.querySelector('div.embed-twitter')).toBeTruthy();
  });
});
