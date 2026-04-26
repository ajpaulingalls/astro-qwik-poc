import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { RelatedStories } from './RelatedStories';
import { getByHeading } from '../test-utils/dom';
import type { HomepagePost } from '@aje-poc/shared-types';

const post = (i: number): HomepagePost => ({
  id: String(3000 + i),
  title: `Related story ${i + 1}`,
  link: `/related/${i + 1}`,
  featuredImage: {
    sourceUrl: `/wp-content/uploads/2026/04/related-${i + 1}.jpg`,
    alt: `Related ${i + 1}`,
    width: 800,
    height: 533,
  },
});

const posts = Array.from({ length: 5 }).map((_, i) => post(i));

describe('RelatedStories', () => {
  it('renders the default section heading "Related stories" as h2', async () => {
    const { screen, render } = await createDOM();
    await render(<RelatedStories posts={posts} />);
    expect(getByHeading(screen, 2, /Related stories/i)).toBeTruthy();
  });

  it('renders a custom title when provided', async () => {
    const { screen, render } = await createDOM();
    await render(<RelatedStories posts={posts} title="More on this story" />);
    expect(getByHeading(screen, 2, /More on this story/i)).toBeTruthy();
    expect(screen.querySelector('section')?.textContent).not.toContain('Related stories');
  });

  it('renders each post as a card linking to its post.link with a heading', async () => {
    const { screen, render } = await createDOM();
    await render(<RelatedStories posts={posts} />);
    const cards = screen.querySelectorAll('section.related-stories article');
    expect(cards.length).toBe(5);
    posts.forEach((p, i) => {
      const card = cards[i];
      const link = card.querySelector('a')!;
      expect(link.getAttribute('href')).toBe(p.link);
      // Mutation-detected: card title must be a heading element
      expect(getByHeading(card, 3, p.title)).toBeTruthy();
    });
  });

  it('caps at 6 posts when given more', async () => {
    const many = Array.from({ length: 10 }).map((_, i) => post(i));
    const { screen, render } = await createDOM();
    await render(<RelatedStories posts={many} />);
    const cards = screen.querySelectorAll('section.related-stories article');
    expect(cards.length).toBe(6);
  });

  it('returns null when posts array is empty', async () => {
    const { screen, render } = await createDOM();
    await render(<RelatedStories posts={[]} />);
    expect(screen.querySelector('section.related-stories')).toBeFalsy();
  });
});
