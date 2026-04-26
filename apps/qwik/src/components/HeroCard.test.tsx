import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { HeroCard } from './HeroCard';
import { getByHeading } from '../test-utils/dom';
import type { HomepagePost } from '@aje-poc/shared-types';

const post: HomepagePost = {
  id: '4511785',
  title: 'Iran war live: Trump says ceasefire extended',
  excerpt: 'Lebanon raises death toll from weeks of Israeli attacks.',
  link: '/news/liveblog/2026/4/22/iran-war-live',
  postType: 'liveblog',
  isLive: true,
  featuredImage: {
    sourceUrl: '/wp-content/uploads/2026/04/anti-us-mural.jpg',
    alt: 'People walk past an anti-US mural in Tehran',
    width: 1200,
    height: 800,
  },
};

describe('HeroCard', () => {
  it('renders the post title as h2 and links to post.link', async () => {
    const { screen, render } = await createDOM();
    await render(<HeroCard post={post} />);
    expect(getByHeading(screen, 2, /Iran war live/i)).toBeTruthy();
    const link = screen.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('/news/liveblog/2026/4/22/iran-war-live');
  });

  it('renders the featuredImage with eager loading + fetchpriority high (LCP element)', async () => {
    const { screen, render } = await createDOM();
    await render(<HeroCard post={post} />);
    const img = screen.querySelector('img')!;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe(
      'http://localhost:4455/wp-content/uploads/2026/04/anti-us-mural.jpg',
    );
    expect(img.getAttribute('alt')).toBe('People walk past an anti-US mural in Tehran');
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
  });

  it('renders the excerpt when present', async () => {
    const { screen, render } = await createDOM();
    await render(<HeroCard post={post} />);
    expect(screen.querySelector('p.excerpt')?.textContent).toContain('Lebanon raises death toll');
  });

  it('omits excerpt cleanly when missing', async () => {
    const { screen, render } = await createDOM();
    await render(<HeroCard post={{ ...post, excerpt: undefined }} />);
    expect(screen.querySelector('p.excerpt')).toBeFalsy();
  });

  it('shows a LIVE badge when isLive is true', async () => {
    const { screen, render } = await createDOM();
    await render(<HeroCard post={post} />);
    expect(screen.querySelector('span.text-aj-orange')?.textContent).toBe('LIVE');
  });

  it('omits LIVE badge when isLive is false', async () => {
    const { screen, render } = await createDOM();
    await render(<HeroCard post={{ ...post, isLive: false }} />);
    expect(screen.querySelector('span.text-aj-orange')).toBeFalsy();
  });

  it('renders without an image when featuredImage is null', async () => {
    const { screen, render } = await createDOM();
    await render(<HeroCard post={{ ...post, featuredImage: null }} />);
    expect(screen.querySelector('img')).toBeFalsy();
  });

  it('honors replacementHeadline when present', async () => {
    const { screen, render } = await createDOM();
    await render(<HeroCard post={{ ...post, replacementHeadline: 'Editor override' }} />);
    expect(getByHeading(screen, 2, /Editor override/i)).toBeTruthy();
  });
});
