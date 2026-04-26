import { describe, it, expect } from 'vitest';
import { getDisplayHeadline } from './headline';
import type { HomepagePost } from '@aje-poc/shared-types';

const base: HomepagePost = { id: '1', title: 'Canonical title', link: '/x' };

describe('getDisplayHeadline', () => {
  it('returns the canonical title when no replacement is set', () => {
    expect(getDisplayHeadline(base)).toBe('Canonical title');
  });

  it('returns the replacement headline when set to a non-empty string', () => {
    expect(getDisplayHeadline({ ...base, replacementHeadline: 'Editor pick' })).toBe('Editor pick');
  });

  // Production CMS sends replacementHeadline as '' (not undefined) when the
  // editor leaves it blank. ?? would return '', producing empty-rendered
  // links across HeroCard/StoryCard/MostPopular/CuratedCollection/RelatedStories.
  it('falls back to the canonical title when replacementHeadline is empty string', () => {
    expect(getDisplayHeadline({ ...base, replacementHeadline: '' })).toBe('Canonical title');
  });
});
