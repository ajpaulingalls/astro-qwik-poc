import type { StoryCardData } from '@aje-poc/shared-types';

/**
 * Editor override: production CMS lets editors set a headline that
 * differs from the canonical title for display in feeds and lists.
 *
 * Takes StoryCardData (the read-contract for card components) rather than
 * the wider HomepagePost — the function only touches title + replacementHeadline,
 * both of which are in StoryCardData. HomepagePost is still assignable.
 */
export function getDisplayHeadline(post: StoryCardData): string {
  return post.replacementHeadline || post.title;
}
