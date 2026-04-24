// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { HeroCard } from './HeroCard';
import type { HomepagePost } from '../lib/homepage-types';

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
  afterEach(cleanup);

  it('renders the post title and links to post.link', () => {
    const { getByRole } = render(<HeroCard post={post} />);
    const link = getByRole('link', { name: /Iran war live/i });
    expect(link.getAttribute('href')).toBe('/news/liveblog/2026/4/22/iran-war-live');
  });

  it('renders the featuredImage with eager loading + fetchpriority high (LCP element)', () => {
    const { container } = render(<HeroCard post={post} />);
    const img = container.querySelector('img')!;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('/wp-content/uploads/2026/04/anti-us-mural.jpg');
    expect(img.getAttribute('alt')).toBe('People walk past an anti-US mural in Tehran');
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
  });

  it('renders the excerpt when present', () => {
    const { getByText } = render(<HeroCard post={post} />);
    expect(getByText(/Lebanon raises death toll/i)).toBeTruthy();
  });

  it('omits excerpt cleanly when missing', () => {
    const { container } = render(<HeroCard post={{ ...post, excerpt: undefined }} />);
    expect(container.querySelector('p.excerpt')).toBeNull();
  });

  it('shows a LIVE badge when isLive is true', () => {
    const { container } = render(<HeroCard post={post} />);
    const badge = container.querySelector('.live-badge');
    expect(badge?.textContent).toBe('LIVE');
  });

  it('omits LIVE badge when isLive is false', () => {
    const { container } = render(<HeroCard post={{ ...post, isLive: false }} />);
    expect(container.querySelector('.live-badge')).toBeNull();
  });

  it('renders without an image when featuredImage is null', () => {
    const { container } = render(<HeroCard post={{ ...post, featuredImage: null }} />);
    expect(container.querySelector('img')).toBeNull();
  });
});
