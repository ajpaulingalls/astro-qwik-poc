import type { HomepagePost } from '@aje-poc/shared-types';

/**
 * Editor override: production CMS lets editors set a headline that
 * differs from the canonical title for display in feeds and lists.
 */
export function getDisplayHeadline(post: HomepagePost): string {
  return post.replacementHeadline || post.title;
}
