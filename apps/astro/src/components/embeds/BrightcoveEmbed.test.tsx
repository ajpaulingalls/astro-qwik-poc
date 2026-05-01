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
    const { container } = render(
      <BrightcoveEmbed html={BRIGHTCOVE_HTML} account="665003303001" player="6tKQRAx7lu" />,
    );
    const video = container.querySelector('video-js');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('data-account')).toBe('665003303001');
    expect(video?.getAttribute('data-player')).toBe('6tKQRAx7lu');
  });

  it('injects the per-account/per-player Brightcove script derived from props (not html)', () => {
    // Props deliberately differ from the data-account/data-player in BRIGHTCOVE_HTML.
    // Component must use the props (the segmenter is the canonical source) and not
    // re-parse the html — proves the deriveScriptSrc duplication is gone.
    render(<BrightcoveEmbed html={BRIGHTCOVE_HTML} account="propAccount" player="propPlayer" />);
    const propBased = `${SCRIPT_PREFIX}propAccount/propPlayer_default/index.min.js`;
    const htmlBased = `${SCRIPT_PREFIX}665003303001/6tKQRAx7lu_default/index.min.js`;
    expect(document.querySelector(`script[src="${propBased}"]`)).toBeTruthy();
    expect(document.querySelector(`script[src="${htmlBased}"]`)).toBeNull();
  });

  it('does not duplicate the script across two BrightcoveEmbeds with the same account/player', () => {
    render(<BrightcoveEmbed html={BRIGHTCOVE_HTML} account="665003303001" player="6tKQRAx7lu" />);
    cleanup();
    render(<BrightcoveEmbed html={BRIGHTCOVE_HTML} account="665003303001" player="6tKQRAx7lu" />);
    expect(document.querySelectorAll(`script[src^="${SCRIPT_PREFIX}"]`).length).toBe(1);
  });

  it('strips inline style="" attributes from CMS markup before render (CSP pin)', () => {
    // Astro CSP blocks style-src-attr; if stripInlineStyles is removed from the
    // component, this test catches it. BRIGHTCOVE_HTML has style="display: block;"
    // and style="padding-top: 56%;" — neither must reach the DOM.
    const { container } = render(
      <BrightcoveEmbed html={BRIGHTCOVE_HTML} account="665003303001" player="6tKQRAx7lu" />,
    );
    const styledNodes = container.querySelectorAll('[style]');
    expect(styledNodes.length).toBe(0);
  });
});
