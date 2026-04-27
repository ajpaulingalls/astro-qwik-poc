import { describe, it, expect } from 'vitest';
import { relatedPostsFrom } from './related-posts';
import type { CuratedCollectionItem, HomepagePost } from '@aje-poc/shared-types';

const post = (id: number, title: string): HomepagePost => ({
  id: String(id),
  title,
  link: `/news/${id}`,
});

describe('relatedPostsFrom', () => {
  it('returns empty when curatedCollection is empty', () => {
    expect(relatedPostsFrom([])).toEqual([]);
  });

  it('flatMaps posts across all curated collections (not just the first)', () => {
    const collections: CuratedCollectionItem[] = [
      { title: 'Top', posts: [post(1, 'A'), post(2, 'B')] },
      { title: 'Middle East', posts: [post(3, 'C'), post(4, 'D')] },
      { title: 'Sport', posts: [post(5, 'E')] },
    ];
    const result = relatedPostsFrom(collections);
    expect(result.map((p) => p.title)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('caps the result at MAX_RELATED (6) regardless of total available posts', () => {
    const collections: CuratedCollectionItem[] = [
      { title: 'Top', posts: Array.from({ length: 5 }, (_, i) => post(i, `T${i}`)) },
      { title: 'Middle East', posts: Array.from({ length: 5 }, (_, i) => post(10 + i, `M${i}`)) },
    ];
    const result = relatedPostsFrom(collections);
    expect(result.length).toBe(6);
    // Should include posts from both collections (catches regression to [0]?.posts)
    expect(result.some((p) => p.title.startsWith('T'))).toBe(true);
    expect(result.some((p) => p.title.startsWith('M'))).toBe(true);
  });
});
