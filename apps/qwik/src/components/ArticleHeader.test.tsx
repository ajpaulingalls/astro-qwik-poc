import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { ArticleHeader } from './ArticleHeader';
import { resolveImageUrl } from '../lib/image-url';
import { getByHeading } from '../test-utils/dom';
import { DISPLAY_HEADLINE_CLASS } from '../lib/typography';
import type { Article } from '@aje-poc/shared-types';

const baseArticle: Article = {
  id: '1',
  title: 'Russian oil exports slump as Ukraine hammers ports and refineries',
  link: '/features/2026/4/24/russian-oil-exports-slump',
  subheading:
    'Despite US sanctions waiver, Russian oil exports could fall to lowest levels since 2023.',
  date: '2026-04-24T16:52:48',
  content: '<p>Body content omitted in header tests.</p>',
  author: [{ name: 'John T Psaropoulos', link: '/author/john_psaropoulos' }],
  categories: [
    { name: 'Features', link: '/features/', slug: 'features' },
    { name: 'News', link: '/news/', slug: 'news' },
  ],
};

describe('ArticleHeader', () => {
  it('renders the article title as h1 (mutation-detected via getByHeading)', async () => {
    const { screen, render } = await createDOM();
    await render(<ArticleHeader article={baseArticle} />);
    expect(getByHeading(screen, 1, /Russian oil exports slump/i)).toBeTruthy();
  });

  it('renders the h1 with the shared DISPLAY_HEADLINE_CLASS', async () => {
    const { screen, render } = await createDOM();
    await render(<ArticleHeader article={baseArticle} />);
    const h1 = getByHeading(screen, 1, /Russian oil exports slump/i);
    expect(h1.className).toContain(DISPLAY_HEADLINE_CLASS);
  });

  it('renders the subheading when present and omits the element when missing', async () => {
    const { screen, render } = await createDOM();
    await render(<ArticleHeader article={baseArticle} />);
    const sub = screen.querySelector('p.subheading');
    expect(sub?.textContent).toContain('US sanctions waiver');

    const { screen: screen2, render: render2 } = await createDOM();
    await render2(<ArticleHeader article={{ ...baseArticle, subheading: undefined }} />);
    expect(screen2.querySelector('p.subheading')).toBeFalsy();
  });

  it('renders unlinked authors as plain text spans (mirror of Astro contract)', async () => {
    const { screen, render } = await createDOM();
    await render(
      <ArticleHeader
        article={{
          ...baseArticle,
          author: [
            { name: 'John T Psaropoulos', link: '/author/john_psaropoulos' },
            { name: 'Anonymous Wire' },
          ],
        }}
      />,
    );
    const byline = screen.querySelector('.byline')!;
    expect(byline).toBeTruthy();
    const links = byline.querySelectorAll('a');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('/author/john_psaropoulos');
    expect(byline.textContent).toContain('Anonymous Wire');
  });

  it('uses plain ", " text between authors (no wrapper <span class="mr-1">)', async () => {
    const { screen, render } = await createDOM();
    await render(
      <ArticleHeader
        article={{
          ...baseArticle,
          author: [
            { name: 'John T Psaropoulos', link: '/author/john_psaropoulos' },
            { name: 'Jane Doe', link: '/author/jane_doe' },
          ],
        }}
      />,
    );
    const byline = screen.querySelector('.byline')!;
    expect(byline.querySelectorAll('span.mr-1').length).toBe(0);
    expect(byline.textContent).toContain('John T Psaropoulos, Jane Doe');
  });

  it('formats the date as "DD Month YYYY" inside a <time> with ISO datetime attr', async () => {
    const { screen, render } = await createDOM();
    await render(<ArticleHeader article={baseArticle} />);
    const time = screen.querySelector('time')!;
    expect(time).toBeTruthy();
    expect(time.getAttribute('datetime')).toBe('2026-04-24T16:52:48');
    expect(time.textContent).toContain('24');
    expect(time.textContent).toContain('April');
    expect(time.textContent).toContain('2026');
  });

  it('renders categories as a semantic ul with li children (mirror Astro markup)', async () => {
    const { screen, render } = await createDOM();
    await render(<ArticleHeader article={baseArticle} />);
    const ul = screen.querySelector('ul.categories');
    expect(ul).toBeTruthy();
    const items = ul!.querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(ul!.querySelectorAll('span').length).toBe(0);
    const catLinks = screen.querySelectorAll('ul.categories li a');
    expect(catLinks.length).toBe(2);
    expect(catLinks[0].getAttribute('href')).toBe('/features/');
    expect(catLinks[0].textContent).toBe('Features');
    expect(catLinks[1].getAttribute('href')).toBe('/news/');
    expect(catLinks[1].textContent).toBe('News');
  });

  it('renders no .categories element when categories is empty', async () => {
    const { screen, render } = await createDOM();
    await render(<ArticleHeader article={{ ...baseArticle, categories: [] }} />);
    expect(screen.querySelector('.categories')).toBeFalsy();
  });

  it('renders featuredImage with eager loading + fetchpriority high (article LCP)', async () => {
    const { screen, render } = await createDOM();
    await render(
      <ArticleHeader
        article={{
          ...baseArticle,
          featuredImage: {
            sourceUrl: '/wp-content/uploads/2026/04/oil.jpg',
            alt: 'Oil spill at Tuapse',
            width: 1200,
            height: 800,
          },
        }}
      />,
    );
    const img = screen.querySelector('img.lead-image')!;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe(resolveImageUrl('/wp-content/uploads/2026/04/oil.jpg'));
    expect(img.getAttribute('alt')).toBe('Oil spill at Tuapse');
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
    expect(img.getAttribute('decoding')).toBe('async');
  });

  it('omits the lead image cleanly when featuredImage is missing', async () => {
    const { screen, render } = await createDOM();
    await render(<ArticleHeader article={baseArticle} />);
    expect(screen.querySelector('img.lead-image')).toBeFalsy();
  });
});
