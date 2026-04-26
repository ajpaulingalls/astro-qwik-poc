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

  it('uses custom embedRenderer when provided (extension seam for story-005)', async () => {
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
});
