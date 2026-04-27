import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { ArticleBody } from './ArticleBody';

const HTML = `<p>First paragraph with <a href="/inner">inline link</a>.</p>
<h2 id="section-1">Section heading</h2>
<p>Second paragraph.</p>
<figure class="wp-caption"><img src="/wp-content/uploads/2026/04/x.jpg" alt="x"><figcaption>x caption</figcaption></figure>`;

describe('ArticleBody', () => {
  it('renders the content HTML inside an .article-body wrapper', async () => {
    const { screen, render } = await createDOM();
    await render(<ArticleBody content={HTML} />);
    const body = screen.querySelector('.article-body')!;
    expect(body).toBeTruthy();
    expect(body.querySelectorAll('p').length).toBe(2);
    expect(body.querySelector('h2')?.getAttribute('id')).toBe('section-1');
    const img = body.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/wp-content/uploads/2026/04/x.jpg');
    expect(body.querySelector('figcaption')?.textContent).toBe('x caption');
    expect(body.querySelector('a')?.getAttribute('href')).toBe('/inner');
  });

  it('preserves inline HTML (links, formatting) verbatim from content', async () => {
    const { screen, render } = await createDOM();
    await render(
      <ArticleBody content={'<p>Mix of <strong>bold</strong> and <em>italic</em>.</p>'} />,
    );
    expect(screen.querySelector('strong')?.textContent).toBe('bold');
    expect(screen.querySelector('em')?.textContent).toBe('italic');
  });

  it('uses custom embedRenderer when provided (escape hatch applied before segmentation)', async () => {
    let received: string | undefined;
    const { screen, render } = await createDOM();
    await render(
      <ArticleBody
        content={HTML}
        embedRenderer={(html) => {
          received = html;
          return <div data-test="custom-renderer">replaced</div>;
        }}
      />,
    );
    expect(received).toBe(HTML);
    const custom = screen.querySelector('[data-test="custom-renderer"]')!;
    expect(custom.textContent).toBe('replaced');
    expect(screen.querySelector('p')).toBeFalsy();
  });

  it('dispatches twitter-tweet blockquote to TwitterEmbed wrapper', async () => {
    const html = `<p>Before.</p><blockquote class="twitter-tweet"><p>tweet</p></blockquote><p>After.</p>`;
    const { screen, render } = await createDOM();
    await render(<ArticleBody content={html} />);
    expect(screen.querySelector('div.embed-twitter blockquote.twitter-tweet')).toBeTruthy();
    expect(screen.textContent).toContain('Before');
    expect(screen.textContent).toContain('After');
  });

  it('dispatches instagram-media blockquote to InstagramEmbed wrapper', async () => {
    const html = `<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/X/"><a href="https://www.instagram.com/p/X/">View</a></blockquote>`;
    const { screen, render } = await createDOM();
    await render(<ArticleBody content={html} />);
    expect(screen.querySelector('div.embed-instagram blockquote.instagram-media')).toBeTruthy();
  });

  it('dispatches wp-block-gallery div to GalleryEmbed wrapper', async () => {
    const html = `<div class="wp-block-gallery has-nested-images columns-3"><figure class="wp-block-image"><img src="/x.jpg"/></figure></div>`;
    const { screen, render } = await createDOM();
    await render(<ArticleBody content={html} />);
    expect(screen.querySelector('div.embed-gallery div.wp-block-gallery')).toBeTruthy();
  });

  it('dispatches Brightcove video-js wrapper to BrightcoveEmbed', async () => {
    const html = `<!-- Start of Brightcove Player --><div><video-js data-account="A" data-player="P" class="video-js"></video-js></div><!-- End of Brightcove Player -->`;
    const { screen, render } = await createDOM();
    await render(<ArticleBody content={html} />);
    const embed = screen.querySelector('div.embed-brightcove');
    expect(embed).toBeTruthy();
    expect(embed?.querySelector('video-js')).toBeTruthy();
  });
});
