import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { CuratedCollection } from './CuratedCollection';
import type { CuratedCollectionItem, HomepagePost } from '@aje-poc/shared-types';

const post = (i: number): HomepagePost => ({
  id: String(2000 + i),
  title: `Curated post ${i + 1}`,
  link: `/curated/${i + 1}`,
});

const collection: CuratedCollectionItem = {
  title: 'Featured',
  overrideLink: 'https://www.aljazeera.com/features/',
  posts: Array.from({ length: 5 }).map((_, i) => post(i)),
};

describe('CuratedCollection', () => {
  it('renders the collection title as a section heading linked to overrideLink', async () => {
    const { screen, render } = await createDOM();
    await render(<CuratedCollection collection={collection} />);
    const h3 = screen.querySelector('h3')!;
    expect(h3.textContent).toContain('Featured');
    const titleLink = h3.querySelector('a')!;
    expect(titleLink.getAttribute('href')).toBe('https://www.aljazeera.com/features/');
  });

  it('renders the heading without a link when overrideLink is missing', async () => {
    const { screen, render } = await createDOM();
    await render(<CuratedCollection collection={{ ...collection, overrideLink: undefined }} />);
    const h3 = screen.querySelector('h3')!;
    expect(h3.textContent).toContain('Featured');
    expect(h3.querySelector('a')).toBeFalsy();
  });

  it('renders all posts as links', async () => {
    const { screen, render } = await createDOM();
    await render(<CuratedCollection collection={collection} />);
    const postLinks = screen.querySelectorAll('ul li a');
    expect(postLinks.length).toBe(5);
    collection.posts.forEach((p, i) => {
      expect(postLinks[i].getAttribute('href')).toBe(p.link);
      expect(postLinks[i].textContent).toContain(p.title);
    });
  });

  it('honors replacementHeadline on individual posts', async () => {
    const overridden: HomepagePost = { ...post(0), replacementHeadline: 'Editor pick' };
    const { screen, render } = await createDOM();
    await render(<CuratedCollection collection={{ ...collection, posts: [overridden] }} />);
    const link = screen.querySelector('ul li a')!;
    expect(link.textContent).toContain('Editor pick');
  });

  it('returns null when posts array is empty', async () => {
    const { screen, render } = await createDOM();
    await render(<CuratedCollection collection={{ ...collection, posts: [] }} />);
    expect(screen.querySelector('section')).toBeFalsy();
  });
});
