import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
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
  it('renders the post title as h3 with link to post.link', async () => {
    const { screen, render } = await createDOM();
    await render(<StoryCard post={post} />);
    const h3 = screen.querySelector('h3')!;
    expect(h3.textContent).toContain('Lebanon raises death toll');
    const link = screen.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('/news/lebanon-death-toll');
  });

  it('renders the featuredImage with lazy loading (not LCP)', async () => {
    const { screen, render } = await createDOM();
    await render(<StoryCard post={post} />);
    const img = screen.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/wp-content/uploads/2026/04/lebanon.jpg');
    expect(img.getAttribute('alt')).toBe('Aftermath of attack in Lebanon');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.hasAttribute('fetchpriority')).toBe(false);
  });

  it('renders the excerpt when present', async () => {
    const { screen, render } = await createDOM();
    await render(<StoryCard post={post} />);
    expect(screen.querySelector('p.excerpt')?.textContent).toContain('New figures show');
  });

  it('omits excerpt cleanly when missing', async () => {
    const { screen, render } = await createDOM();
    await render(<StoryCard post={{ ...post, excerpt: undefined }} />);
    expect(screen.querySelector('p.excerpt')).toBeFalsy();
  });

  it('shows LIVE badge when isLive is true', async () => {
    const { screen, render } = await createDOM();
    await render(<StoryCard post={{ ...post, isLive: true }} />);
    expect(screen.querySelector('.live-badge')?.textContent).toBe('LIVE');
  });

  it('omits LIVE badge when isLive is false', async () => {
    const { screen, render } = await createDOM();
    await render(<StoryCard post={{ ...post, isLive: false }} />);
    expect(screen.querySelector('.live-badge')).toBeFalsy();
  });

  it('renders without an image when featuredImage is null', async () => {
    const { screen, render } = await createDOM();
    await render(<StoryCard post={{ ...post, featuredImage: null }} />);
    expect(screen.querySelector('img')).toBeFalsy();
  });

  it('honors replacementHeadline when present', async () => {
    const { screen, render } = await createDOM();
    await render(<StoryCard post={{ ...post, replacementHeadline: 'Editor pick' }} />);
    expect(screen.querySelector('h3')?.textContent).toContain('Editor pick');
  });
});
