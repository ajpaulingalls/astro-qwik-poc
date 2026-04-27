import { describe, it, expect } from 'vitest';
import { parseEmbeds } from './parse-embeds';

describe('parseEmbeds', () => {
  it('returns empty array for empty input', () => {
    expect(parseEmbeds('')).toEqual([]);
  });

  it('returns a single html segment for pure text content', () => {
    const html = '<p>Plain article paragraph.</p><p>Another one.</p>';
    expect(parseEmbeds(html)).toEqual([{ kind: 'html', html }]);
  });

  it('detects a twitter-tweet blockquote and swallows the trailing widgets script', () => {
    const html = `<blockquote class="twitter-tweet"><p>tweet content</p></blockquote>
<p><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script></p>`;
    const segments = parseEmbeds(html);
    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe('embed');
    if (segments[0].kind === 'embed') {
      expect(segments[0].type).toBe('twitter');
      expect(segments[0].html).toContain('twitter-tweet');
      expect(segments[0].html).toContain('tweet content');
      expect(segments[0].html).not.toContain('widgets.js');
    }
  });

  it('detects an instagram-media blockquote and swallows the trailing embed.js script', () => {
    const html = `<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/X/"><a href="https://www.instagram.com/p/X/">View</a></blockquote>
<script async src="//www.instagram.com/embed.js"></script>`;
    const segments = parseEmbeds(html);
    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe('embed');
    if (segments[0].kind === 'embed') {
      expect(segments[0].type).toBe('instagram');
      expect(segments[0].html).toContain('instagram-media');
      expect(segments[0].html).not.toContain('embed.js');
    }
  });

  it('detects a wp-block-gallery div', () => {
    const html =
      '<div class="wp-block-gallery has-nested-images columns-3 is-cropped"><figure class="wp-block-image"><img src="/x.jpg" /></figure></div>';
    const segments = parseEmbeds(html);
    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe('embed');
    if (segments[0].kind === 'embed') {
      expect(segments[0].type).toBe('gallery');
      expect(segments[0].html).toContain('wp-block-gallery');
      expect(segments[0].html).toContain('wp-block-image');
    }
  });

  it('detects a brightcove video-js wrapper and swallows the trailing player script', () => {
    const html = `<!-- Start of Brightcove Player -->
<div style="display: block; position: relative;">
  <div style="padding-top: 56%;" data-bc="true">
    <video-js id="6393574500112" data-video-id="6393574500112" data-account="665003303001" data-player="6tKQRAx7lu" class="video-js" controls></video-js>
  </div>
  <script async defer src="https://players.brightcove.net/665003303001/6tKQRAx7lu_default/index.min.js"></script>
</div>
<!-- End of Brightcove Player -->`;
    const segments = parseEmbeds(html);
    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe('embed');
    if (segments[0].kind === 'embed') {
      expect(segments[0].type).toBe('brightcove');
      expect(segments[0].html).toContain('video-js');
      expect(segments[0].html).toContain('data-account="665003303001"');
      expect(segments[0].html).toContain('data-player="6tKQRAx7lu"');
      expect(segments[0].html).not.toContain('players.brightcove.net');
    }
  });

  it('extracts brightcove account/player/videoId as segment props (no html re-parse needed)', () => {
    const html = `<!-- Start of Brightcove Player -->
<div><video-js id="6393574500112" data-video-id="6393574500112" data-account="665003303001" data-player="6tKQRAx7lu" class="video-js"></video-js></div>
<!-- End of Brightcove Player -->`;
    const segments = parseEmbeds(html);
    expect(segments).toHaveLength(1);
    const seg = segments[0];
    if (seg.kind === 'embed' && seg.type === 'brightcove') {
      expect(seg.account).toBe('665003303001');
      expect(seg.player).toBe('6tKQRAx7lu');
      expect(seg.videoId).toBe('6393574500112');
    } else {
      throw new Error('expected brightcove embed segment');
    }
  });

  it('preserves html before and after an embed in order', () => {
    const html = `<p>Intro.</p><blockquote class="twitter-tweet"><p>tweet</p></blockquote><p>Outro.</p>`;
    const segments = parseEmbeds(html);
    expect(segments.map((s) => s.kind)).toEqual(['html', 'embed', 'html']);
    if (segments[0].kind === 'html') expect(segments[0].html).toContain('Intro');
    if (segments[2].kind === 'html') expect(segments[2].html).toContain('Outro');
  });

  it('handles multiple embeds in sequence', () => {
    const html = `<p>A</p><blockquote class="twitter-tweet"><p>t</p></blockquote><p>B</p><div class="wp-block-gallery"><figure class="wp-block-image"><img/></figure></div><p>C</p>`;
    const segments = parseEmbeds(html);
    const kinds = segments.map((s) => s.kind);
    expect(kinds).toEqual(['html', 'embed', 'html', 'embed', 'html']);
    const types = segments
      .filter((s) => s.kind === 'embed')
      .map((s) => (s as { type: string }).type);
    expect(types).toEqual(['twitter', 'gallery']);
  });

  it('does not match a blockquote without the recognized class', () => {
    const html = '<blockquote>Just a quote.</blockquote>';
    expect(parseEmbeds(html)).toEqual([{ kind: 'html', html }]);
  });

  it('emits a twitter embed even when the trailing widgets script is absent', () => {
    const html = `<blockquote class="twitter-tweet"><p>orphan tweet</p></blockquote>`;
    const segments = parseEmbeds(html);
    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe('embed');
    if (segments[0].kind === 'embed') expect(segments[0].type).toBe('twitter');
  });

  it('handles two consecutive brightcove embeds independently', () => {
    const html = `<!-- Start of Brightcove Player -->
<div><video-js data-account="A" data-player="P1" class="video-js"></video-js><script async defer src="https://players.brightcove.net/A/P1_default/index.min.js"></script></div>
<!-- End of Brightcove Player -->
<!-- Start of Brightcove Player -->
<div><video-js data-account="B" data-player="P2" class="video-js"></video-js><script async defer src="https://players.brightcove.net/B/P2_default/index.min.js"></script></div>
<!-- End of Brightcove Player -->`;
    const segments = parseEmbeds(html);
    const embeds = segments.filter((s) => s.kind === 'embed');
    expect(embeds).toHaveLength(2);
    if (embeds[0].kind === 'embed' && embeds[1].kind === 'embed') {
      expect(embeds[0].type).toBe('brightcove');
      expect(embeds[1].type).toBe('brightcove');
      expect(embeds[0].html).toContain('data-account="A"');
      expect(embeds[1].html).toContain('data-account="B"');
      expect(embeds[0].html).not.toContain('players.brightcove.net');
      expect(embeds[1].html).not.toContain('players.brightcove.net');
    }
  });

  it('falls back to html segment for an unclosed blockquote (silent skip)', () => {
    const html = '<blockquote class="twitter-tweet"><p>tweet without closing tag';
    expect(parseEmbeds(html)).toEqual([{ kind: 'html', html }]);
  });
});
