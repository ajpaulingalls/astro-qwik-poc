import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { ArticleHeader } from './ArticleHeader';
import { getByHeading } from '../test-utils/dom';

const props = {
  title: 'Russian oil exports slump as Ukraine hammers ports and refineries',
  subheading:
    'Despite US sanctions waiver, Russian oil exports could fall to lowest levels since 2023.',
  authors: [{ name: 'John T Psaropoulos', link: '/author/john_psaropoulos' }],
  date: '2026-04-24T16:52:48',
  categories: [
    { name: 'Features', link: '/features/' },
    { name: 'News', link: '/news/' },
  ],
};

describe('ArticleHeader', () => {
  it('renders the article title as h1 (mutation-detected via getByHeading)', async () => {
    const { screen, render } = await createDOM();
    await render(<ArticleHeader {...props} />);
    expect(getByHeading(screen, 1, /Russian oil exports slump/i)).toBeTruthy();
  });

  it('renders the subheading when present and omits the element when missing', async () => {
    const { screen, render } = await createDOM();
    await render(<ArticleHeader {...props} />);
    const sub = screen.querySelector('p.subheading');
    expect(sub?.textContent).toContain('US sanctions waiver');

    const { screen: screen2, render: render2 } = await createDOM();
    await render2(<ArticleHeader {...props} subheading={undefined} />);
    expect(screen2.querySelector('p.subheading')).toBeFalsy();
  });

  it('renders each author as a link when href present and as plain text otherwise', async () => {
    const { screen, render } = await createDOM();
    await render(
      <ArticleHeader
        {...props}
        authors={[
          { name: 'John T Psaropoulos', link: '/author/john_psaropoulos' },
          { name: 'Anonymous Wire' },
        ]}
      />,
    );
    const byline = screen.querySelector('.byline')!;
    expect(byline).toBeTruthy();
    const link = byline.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('/author/john_psaropoulos');
    expect(link.textContent).toBe('John T Psaropoulos');
    expect(byline.textContent).toContain('Anonymous Wire');
  });

  it('formats the date as "DD Month YYYY" inside a <time> with ISO datetime attr', async () => {
    const { screen, render } = await createDOM();
    await render(<ArticleHeader {...props} />);
    const time = screen.querySelector('time')!;
    expect(time).toBeTruthy();
    expect(time.getAttribute('datetime')).toBe('2026-04-24T16:52:48');
    expect(time.textContent).toContain('24');
    expect(time.textContent).toContain('April');
    expect(time.textContent).toContain('2026');
  });

  it('renders each category as an anchor with the category link', async () => {
    const { screen, render } = await createDOM();
    await render(<ArticleHeader {...props} />);
    const catLinks = screen.querySelectorAll('.categories a');
    expect(catLinks.length).toBe(2);
    expect(catLinks[0].getAttribute('href')).toBe('/features/');
    expect(catLinks[0].textContent).toBe('Features');
    expect(catLinks[1].getAttribute('href')).toBe('/news/');
    expect(catLinks[1].textContent).toBe('News');
  });

  it('renders no .categories element when categories is empty', async () => {
    const { screen, render } = await createDOM();
    await render(<ArticleHeader {...props} categories={[]} />);
    expect(screen.querySelector('.categories')).toBeFalsy();
  });

  it('renders featuredImage with eager loading + fetchpriority high (article LCP)', async () => {
    const { screen, render } = await createDOM();
    await render(
      <ArticleHeader
        {...props}
        featuredImage={{
          sourceUrl: '/wp-content/uploads/2026/04/oil.jpg',
          alt: 'Oil spill at Tuapse',
          width: 1200,
          height: 800,
        }}
      />,
    );
    const img = screen.querySelector('img.lead-image')!;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe(
      'http://localhost:4455/wp-content/uploads/2026/04/oil.jpg',
    );
    expect(img.getAttribute('alt')).toBe('Oil spill at Tuapse');
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
  });

  it('omits the lead image cleanly when featuredImage is missing', async () => {
    const { screen, render } = await createDOM();
    await render(<ArticleHeader {...props} />);
    expect(screen.querySelector('img.lead-image')).toBeFalsy();
  });
});
