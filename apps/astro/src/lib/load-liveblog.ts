import type { LiveBlogShell } from '@aje-poc/shared-types';
import { GraphqlHttpError } from './graphql';
import { fetchLiveBlogShell, fetchLiveBlogUpdate, type LiveBlogUpdate } from './liveblog-api';

// Production above-the-fold count for live blog updates. Updater hydration
// can later lazy-fetch older entries; SSR ships this many in parallel.
export const INITIAL_ENTRY_COUNT = 5;

export interface LiveBlogPageData {
  shell: LiveBlogShell;
  entries: LiveBlogUpdate[];
}

export interface LiveBlogNotFound {
  notFound: true;
  slug: string;
}

export async function loadLiveBlogData(slug: string): Promise<LiveBlogPageData | LiveBlogNotFound> {
  let shell: LiveBlogShell | null;
  try {
    shell = await fetchLiveBlogShell(slug);
  } catch (err) {
    if (err instanceof GraphqlHttpError && err.status === 404) {
      return { notFound: true, slug };
    }
    throw err;
  }
  if (!shell) return { notFound: true, slug };

  const childMeta = shell.childrenMeta ?? [];
  const initial = childMeta.slice(0, INITIAL_ENTRY_COUNT);
  // allSettled (not all): per-update fixtures may not exist for every id (only
  // 3 LiveBlogUpdateQuery--*.json fixtures committed; production also returns
  // no_posts_found for some ids). Filter to fulfilled+non-null so the page
  // still renders the entries we have.
  const settled = await Promise.allSettled(
    initial.map((meta) => fetchLiveBlogUpdate(Number(meta.id))),
  );
  const entries = settled
    .filter(
      (r): r is PromiseFulfilledResult<LiveBlogUpdate> =>
        r.status === 'fulfilled' && r.value !== null,
    )
    .map((r) => r.value);

  return { shell, entries };
}
