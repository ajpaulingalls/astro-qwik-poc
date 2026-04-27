import { describe, it, expect, vi, afterEach } from 'vitest';
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

  it('falls back to html segment for an unclosed blockquote (silent skip)', () => {
    const html = '<blockquote class="twitter-tweet"><p>tweet without closing tag';
    expect(parseEmbeds(html)).toEqual([{ kind: 'html', html }]);
  });

  it('detects a YouTube iframe embed', () => {
    const html = `<p>Intro.</p><figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio">
<div class="wp-block-embed__wrapper">
<iframe loading="lazy" title="YouTube video player" width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ?feature=oembed" frameborder="0" allow="accelerometer" allowfullscreen></iframe>
</div>
</figure><p>Outro.</p>`;
    const segments = parseEmbeds(html);
    expect(segments.map((s) => s.kind)).toEqual(['html', 'embed', 'html']);
    const embed = segments[1];
    if (embed.kind === 'embed') {
      expect(embed.type).toBe('youtube');
      expect(embed.html).toContain('youtube.com/embed/dQw4w9WgXcQ');
      expect(embed.html).toContain('<iframe');
    } else {
      throw new Error('expected youtube embed segment');
    }
  });

  it('detects a bare YouTube iframe (no wp-block-embed wrapper)', () => {
    const html = `<p>before</p><iframe src="https://www.youtube.com/embed/abc123XYZ_-" allowfullscreen></iframe><p>after</p>`;
    const segments = parseEmbeds(html);
    expect(segments.map((s) => s.kind)).toEqual(['html', 'embed', 'html']);
    const embed = segments[1];
    if (embed.kind === 'embed') {
      expect(embed.type).toBe('youtube');
      expect(embed.html).toContain('youtube.com/embed/abc123XYZ_-');
    } else {
      throw new Error('expected youtube embed segment');
    }
  });

  it('detects a youtube-nocookie iframe', () => {
    const html = `<iframe src="https://www.youtube-nocookie.com/embed/PRIVACY_ID"></iframe>`;
    const segments = parseEmbeds(html);
    expect(segments).toHaveLength(1);
    if (segments[0].kind === 'embed') {
      expect(segments[0].type).toBe('youtube');
    } else {
      throw new Error('expected youtube embed segment');
    }
  });

  describe('orphan video-js warnings', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    afterEach(() => {
      warnSpy.mockClear();
    });

    it('warns when video-js is present but Brightcove comment markers are missing', () => {
      const html = `<p>intro</p><div><video-js id="x" data-account="A" data-player="P" class="video-js"></video-js></div><p>outro</p>`;
      parseEmbeds(html);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const msg = warnSpy.mock.calls[0]?.[0];
      expect(msg).toContain('Brightcove');
      expect(msg).toContain('video-js');
    });

    it('warns when Brightcove comment markers are present but data-account/data-player are missing', () => {
      const html = `<!-- Start of Brightcove Player -->
<div><video-js id="x" class="video-js"></video-js></div>
<!-- End of Brightcove Player -->`;
      parseEmbeds(html);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const msg = warnSpy.mock.calls[0]?.[0];
      expect(msg).toContain('Brightcove');
      expect(msg).toContain('video-js');
    });

    it('does not warn when a well-formed Brightcove embed parses successfully', () => {
      const html = `<!-- Start of Brightcove Player -->
<div><video-js id="x" data-video-id="V" data-account="A" data-player="P" class="video-js"></video-js></div>
<!-- End of Brightcove Player -->`;
      parseEmbeds(html);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
