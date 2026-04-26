// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { ArticleHeader } from './ArticleHeader';

const baseArticle = {
  title: 'Russian oil exports slump as Ukraine hammers ports',
  subheading: 'Despite US sanctions waiver, exports could fall to lowest since 2023.',
  date: '2026-04-24T16:52:48',
  author: [
    { name: 'John T Psaropoulos', link: '/author/john_psaropoulos' },
    { name: 'Jane Doe', link: '/author/jane_doe' },
  ],
  categories: [
    { name: 'Features', link: '/features/', slug: 'features' },
    { name: 'News', link: '/news/', slug: 'news' },
  ],
};

describe('ArticleHeader', () => {
  afterEach(cleanup);

  it('renders the article title as the h1 heading', () => {
    const { getByRole } = render(<ArticleHeader article={baseArticle} />);
    const h1 = getByRole('heading', { level: 1, name: /Russian oil exports/i });
    expect(h1).toBeTruthy();
    expect(h1.tagName).toBe('H1');
  });

  it('renders the subheading when present', () => {
    const { container } = render(<ArticleHeader article={baseArticle} />);
    expect(container.textContent).toContain('Despite US sanctions waiver');
  });

  it('omits the subheading element entirely when empty string', () => {
    const { container } = render(<ArticleHeader article={{ ...baseArticle, subheading: '' }} />);
    expect(container.querySelector('.subheading')).toBeNull();
  });

  it('renders all authors as byline links', () => {
    const { container } = render(<ArticleHeader article={baseArticle} />);
    const bylineLinks = container.querySelectorAll('.byline a');
    expect(bylineLinks.length).toBe(2);
    expect(bylineLinks[0].textContent).toContain('John T Psaropoulos');
    expect(bylineLinks[0].getAttribute('href')).toBe('/author/john_psaropoulos');
    expect(bylineLinks[1].textContent).toContain('Jane Doe');
    expect(bylineLinks[1].getAttribute('href')).toBe('/author/jane_doe');
  });

  it('omits byline when no authors are present', () => {
    const { container } = render(<ArticleHeader article={{ ...baseArticle, author: [] }} />);
    expect(container.querySelector('.byline')).toBeNull();
  });

  it('renders the date inside a <time> element with ISO datetime attribute', () => {
    const { container } = render(<ArticleHeader article={baseArticle} />);
    const time = container.querySelector('time');
    expect(time).toBeTruthy();
    expect(time?.getAttribute('datetime')).toBe('2026-04-24T16:52:48');
    expect(time?.textContent).toMatch(/2026/);
    expect(time?.textContent).toMatch(/Apr/);
  });

  it('renders all categories as links to their slug pages', () => {
    const { container } = render(<ArticleHeader article={baseArticle} />);
    const categoryLinks = container.querySelectorAll('.categories a');
    expect(categoryLinks.length).toBe(2);
    expect(categoryLinks[0].textContent).toContain('Features');
    expect(categoryLinks[0].getAttribute('href')).toBe('/features/');
    expect(categoryLinks[1].textContent).toContain('News');
    expect(categoryLinks[1].getAttribute('href')).toBe('/news/');
  });

  it('omits the categories list when empty', () => {
    const { container } = render(<ArticleHeader article={{ ...baseArticle, categories: [] }} />);
    expect(container.querySelector('.categories')).toBeNull();
  });
});
