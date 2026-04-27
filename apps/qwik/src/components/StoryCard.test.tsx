import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { StoryCard } from './StoryCard';
import { getByHeading } from '../test-utils/dom';
import { resolveImageUrl } from '../lib/image-url';
import type { HomepagePost } from '@aje-poc/shared-types';

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
    expect(getByHeading(screen, 3, /Lebanon raises death toll/i)).toBeTruthy();
    const link = screen.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('/news/lebanon-death-toll');
  });

  it('renders the featuredImage with lazy loading (not LCP)', async () => {
    const { screen, render } = await createDOM();
    await render(<StoryCard post={post} />);
    const img = screen.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(resolveImageUrl(post.featuredImage!.sourceUrl));
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
    expect(screen.querySelector('span.text-aj-orange')?.textContent).toBe('LIVE');
  });

  it('omits LIVE badge when isLive is false', async () => {
    const { screen, render } = await createDOM();
    await render(<StoryCard post={{ ...post, isLive: false }} />);
    expect(screen.querySelector('span.text-aj-orange')).toBeFalsy();
  });

  it('renders without an image when featuredImage is null', async () => {
    const { screen, render } = await createDOM();
    await render(<StoryCard post={{ ...post, featuredImage: null }} />);
    expect(screen.querySelector('img')).toBeFalsy();
  });

  it('honors replacementHeadline when present', async () => {
    const { screen, render } = await createDOM();
    await render(<StoryCard post={{ ...post, replacementHeadline: 'Editor pick' }} />);
    expect(getByHeading(screen, 3, /Editor pick/i)).toBeTruthy();
  });
});
