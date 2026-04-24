// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { CuratedCollection } from './CuratedCollection';
import type { CuratedCollectionItem, HomepagePost } from '../lib/homepage-types';

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
  afterEach(cleanup);

  it('renders the collection title as a section heading linked to overrideLink', () => {
    const { getByRole } = render(<CuratedCollection collection={collection} />);
    const heading = getByRole('heading', { level: 3, name: /Featured/i });
    expect(heading).toBeTruthy();
    const titleLink = getByRole('link', { name: /Featured/i });
    expect(titleLink.getAttribute('href')).toBe('https://www.aljazeera.com/features/');
  });

  it('renders the heading without a link when overrideLink is missing', () => {
    const { container, queryByRole } = render(
      <CuratedCollection collection={{ ...collection, overrideLink: undefined }} />,
    );
    expect(container.querySelector('h3')?.textContent).toContain('Featured');
    expect(queryByRole('link', { name: /Featured/i })).toBeNull();
  });

  it('renders all posts as links', () => {
    const { container } = render(<CuratedCollection collection={collection} />);
    const postLinks = container.querySelectorAll('ul li a');
    expect(postLinks.length).toBe(5);
    collection.posts.forEach((p, i) => {
      expect(postLinks[i].getAttribute('href')).toBe(p.link);
      expect(postLinks[i].textContent).toContain(p.title);
    });
  });

  it('honors replacementHeadline on individual posts', () => {
    const overridden: HomepagePost = { ...post(0), replacementHeadline: 'Editor pick' };
    const { container } = render(
      <CuratedCollection collection={{ ...collection, posts: [overridden] }} />,
    );
    const link = container.querySelector('ul li a')!;
    expect(link.textContent).toContain('Editor pick');
  });

  it('returns null when posts array is empty', () => {
    const { container } = render(<CuratedCollection collection={{ ...collection, posts: [] }} />);
    expect(container.querySelector('section')).toBeNull();
  });
});
