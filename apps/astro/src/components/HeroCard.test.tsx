// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { HeroCard } from './HeroCard';
import { resolveImageUrl } from '../lib/image-url';
import { LIVEBLOG_DATE_PREFIX, type HomepagePost } from '@aje-poc/shared-types';

const HERO_LINK = `/news/liveblog/${LIVEBLOG_DATE_PREFIX}/iran-war-live`;

const post: HomepagePost = {
  id: '4511785',
  title: 'Iran war live: Trump says ceasefire extended',
  excerpt: 'Lebanon raises death toll from weeks of Israeli attacks.',
  link: HERO_LINK,
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

  it('renders the post title as h2 and links to post.link', () => {
    const { getByRole } = render(<HeroCard post={post} />);
    const link = getByRole('link', { name: /Iran war live/i });
    expect(link.getAttribute('href')).toBe(HERO_LINK);
    const heading = getByRole('heading', { level: 2, name: /Iran war live/i });
    expect(heading).toBeTruthy();
  });

  it('renders the headline at display scale (text-3xl floor, md:text-4xl, tight leading)', () => {
    const { getByRole } = render(<HeroCard post={post} />);
    const h2 = getByRole('heading', { level: 2 });
    expect(h2.className).toContain('text-3xl');
    expect(h2.className).toContain('md:text-4xl');
    expect(h2.className).toContain('tracking-tight');
    expect(h2.className).toContain('leading-[1.05]');
  });

  it('renders the featuredImage with eager loading + fetchpriority high (LCP element)', () => {
    const { container } = render(<HeroCard post={post} />);
    const img = container.querySelector('img')!;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe(resolveImageUrl(post.featuredImage!.sourceUrl));
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
    const badge = container.querySelector('span.text-aj-orange');
    expect(badge?.textContent).toBe('LIVE');
  });

  it('omits LIVE badge when isLive is false', () => {
    const { container } = render(<HeroCard post={{ ...post, isLive: false }} />);
    expect(container.querySelector('span.text-aj-orange')).toBeNull();
  });

  it('renders without an image when featuredImage is null', () => {
    const { container } = render(<HeroCard post={{ ...post, featuredImage: null }} />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('uses replacementHeadline when present instead of title', () => {
    const { getByRole, queryByRole } = render(
      <HeroCard post={{ ...post, replacementHeadline: 'Editor override headline' }} />,
    );
    expect(getByRole('heading', { level: 2, name: /Editor override headline/i })).toBeTruthy();
    expect(queryByRole('heading', { level: 2, name: /Iran war live/i })).toBeNull();
  });
});
