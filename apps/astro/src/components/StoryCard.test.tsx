// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { StoryCard } from './StoryCard';
import type { HomepagePost } from '../lib/homepage-types';

const post: HomepagePost = {
  id: '4511786',
  title: 'Lebanon raises death toll from Israeli attacks',
  excerpt: 'New figures show 50% increase over the prior week.',
  link: '/news/lebanon-death-toll',
  postType: 'post',
  isLive: false,
  featuredImage: {
    sourceUrl: '/wp-content/uploads/2026/04/lebanon.jpg',
    alt: 'Aftermath of attack in Lebanon',
    width: 800,
    height: 533,
  },
};

describe('StoryCard', () => {
  afterEach(cleanup);

  it('renders the post title as h3 with link to post.link', () => {
    const { getByRole } = render(<StoryCard post={post} />);
    const link = getByRole('link', { name: /Lebanon raises death toll/i });
    expect(link.getAttribute('href')).toBe('/news/lebanon-death-toll');
    const heading = getByRole('heading', { level: 3, name: /Lebanon raises death toll/i });
    expect(heading).toBeTruthy();
  });

  it('renders the featuredImage with lazy loading (not LCP)', () => {
    const { container } = render(<StoryCard post={post} />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/wp-content/uploads/2026/04/lebanon.jpg');
    expect(img.getAttribute('alt')).toBe('Aftermath of attack in Lebanon');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.hasAttribute('fetchpriority')).toBe(false);
  });

  it('renders the excerpt when present', () => {
    const { getByText } = render(<StoryCard post={post} />);
    expect(getByText(/New figures show/i)).toBeTruthy();
  });

  it('omits excerpt cleanly when missing', () => {
    const { container } = render(<StoryCard post={{ ...post, excerpt: undefined }} />);
    expect(container.querySelector('p.excerpt')).toBeNull();
  });

  it('shows LIVE badge when isLive is true', () => {
    const { container } = render(<StoryCard post={{ ...post, isLive: true }} />);
    expect(container.querySelector('.live-badge')?.textContent).toBe('LIVE');
  });

  it('renders without an image when featuredImage is null', () => {
    const { container } = render(<StoryCard post={{ ...post, featuredImage: null }} />);
    expect(container.querySelector('img')).toBeNull();
  });
});
