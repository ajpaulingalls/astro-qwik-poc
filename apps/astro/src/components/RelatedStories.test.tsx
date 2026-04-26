// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { RelatedStories } from './RelatedStories';
import type { HomepagePost } from '@aje-poc/shared-types';

const post = (i: number): HomepagePost => ({
  id: String(7000 + i),
  title: `Related story ${i + 1}`,
  link: `/related/${i + 1}`,
});

const posts: HomepagePost[] = Array.from({ length: 6 }).map((_, i) => post(i));

describe('RelatedStories', () => {
  afterEach(cleanup);

  it('renders the section heading "Related stories" as an h2', () => {
    const { getByRole } = render(<RelatedStories posts={posts} />);
    const heading = getByRole('heading', { level: 2, name: /Related stories/i });
    expect(heading.tagName).toBe('H2');
  });

  it('renders one link per post and preserves order (trusts producer)', () => {
    const { container } = render(<RelatedStories posts={posts} />);
    const links = container.querySelectorAll('ul li a');
    expect(links.length).toBe(posts.length);
    posts.forEach((p, i) => {
      expect(links[i].getAttribute('href')).toBe(p.link);
      expect(links[i].textContent).toContain(p.title);
    });
  });

  it('honors replacementHeadline when present on a post', () => {
    const overridden: HomepagePost = { ...post(0), replacementHeadline: 'Editor pick' };
    const { container } = render(<RelatedStories posts={[overridden]} />);
    const link = container.querySelector('ul li a')!;
    expect(link.textContent).toContain('Editor pick');
  });

  it('returns null when posts array is empty (no <section>, no heading)', () => {
    const { container } = render(<RelatedStories posts={[]} />);
    expect(container.querySelector('section')).toBeNull();
    expect(container.querySelector('h2')).toBeNull();
  });
});
