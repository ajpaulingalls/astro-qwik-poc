// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { ArticleBody } from './ArticleBody';

const RICH_CONTENT = [
  '<p>First paragraph with <a href="/news/foo">an inline link</a>.</p>',
  '<p>Second paragraph follows.</p>',
  '<h2 id="section-one">Section one heading</h2>',
  '<p>Content beneath the section heading.</p>',
  '<blockquote><p>A pull quote from a source.</p></blockquote>',
  '<figure class="wp-caption">',
  '<img src="/wp-content/uploads/2026/04/satellite.jpg" alt="A satellite image of an oil spill" width="770" height="432" />',
  '<figcaption class="wp-caption-text">Fire and smoke rise at the Tuapse oil refinery [Reuters]</figcaption>',
  '</figure>',
  '<h2 id="section-two">Section two heading</h2>',
  '<p>Closing paragraph.</p>',
].join('\n');

describe('ArticleBody', () => {
  afterEach(cleanup);

  it('renders paragraph elements from article HTML content', () => {
    const { container } = render(<ArticleBody content={RICH_CONTENT} />);
    const paragraphs = container.querySelectorAll('article p');
    expect(paragraphs.length).toBeGreaterThanOrEqual(4);
    expect(container.textContent).toContain('First paragraph');
    expect(container.textContent).toContain('Closing paragraph');
  });

  it('renders h2 subheadings as actual <h2> elements (mutation-detection)', () => {
    const { getByRole } = render(<ArticleBody content={RICH_CONTENT} />);
    const h2a = getByRole('heading', { level: 2, name: /Section one heading/i });
    const h2b = getByRole('heading', { level: 2, name: /Section two heading/i });
    expect(h2a.tagName).toBe('H2');
    expect(h2b.tagName).toBe('H2');
  });

  it('preserves inline anchor tags within paragraphs', () => {
    const { container } = render(<ArticleBody content={RICH_CONTENT} />);
    const inlineLink = container.querySelector('article p a');
    expect(inlineLink?.getAttribute('href')).toBe('/news/foo');
    expect(inlineLink?.textContent).toBe('an inline link');
  });

  it('renders blockquote elements verbatim from the source HTML', () => {
    const { container } = render(<ArticleBody content={RICH_CONTENT} />);
    const blockquote = container.querySelector('article blockquote');
    expect(blockquote).toBeTruthy();
    expect(blockquote?.textContent).toContain('A pull quote from a source');
  });

  it('renders <figure> with embedded <img> and <figcaption>', () => {
    const { container } = render(<ArticleBody content={RICH_CONTENT} />);
    const figure = container.querySelector('article figure.wp-caption');
    expect(figure).toBeTruthy();
    const img = figure?.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('A satellite image of an oil spill');
    expect(img?.getAttribute('src')).toBe('/wp-content/uploads/2026/04/satellite.jpg');
    const caption = figure?.querySelector('figcaption.wp-caption-text');
    expect(caption?.textContent).toContain('Tuapse oil refinery');
  });

  it('renders nothing when content is empty', () => {
    const { container } = render(<ArticleBody content="" />);
    const article = container.querySelector('article');
    expect(article).toBeTruthy();
    expect(article!.textContent).toBe('');
  });

  it('transforms HTML via transformContent when provided', () => {
    const transformContent = (html: string) =>
      html.replace('<blockquote>', '<blockquote data-transformed="yes">');
    const { container } = render(
      <ArticleBody content={RICH_CONTENT} transformContent={transformContent} />,
    );
    const blockquote = container.querySelector('article blockquote');
    expect(blockquote?.getAttribute('data-transformed')).toBe('yes');
  });
});
