import type { LiveBlogShell } from '@aje-poc/shared-types';
import { graphqlFetch, GraphqlHttpError } from './graphql';

// Production above-the-fold count for live blog updates. Updater hydration
// can later lazy-fetch older entries; SSR ships this many in parallel.
export const INITIAL_ENTRY_COUNT = 5;

// Per-update payload shape. Mirrors what production returns from
// LiveBlogUpdateQuery (postType MUST be "liveblog-update", not "liveblog" —
// see docs/RESEARCH.md §Live Blog).
export interface LiveBlogUpdate {
  id: string;
  title: string;
  content: string;
  date: string;
}

export interface LiveBlogPageData {
  shell: LiveBlogShell;
  entries: LiveBlogUpdate[];
}

export interface LiveBlogNotFound {
  notFound: true;
  slug: string;
}

interface ShellResponse {
  article: LiveBlogShell | null;
}

interface UpdateResponse {
  // Per-update payload may be null if the postID 404s (no_posts_found).
  posts: LiveBlogUpdate | null;
}

export async function loadLiveBlogData(slug: string): Promise<LiveBlogPageData | LiveBlogNotFound> {
  let shellData: ShellResponse;
  try {
    shellData = await graphqlFetch<ShellResponse>({
      operationName: 'ArchipelagoSingleLiveBlogQuery',
      variables: { name: slug, postType: 'liveblog', preview: '' },
    });
  } catch (err) {
    if (err instanceof GraphqlHttpError && err.status === 404) {
      return { notFound: true, slug };
    }
    throw err;
  }
  const shell = shellData.article;
  if (!shell) return { notFound: true, slug };

  const childMeta = shell.childrenMeta ?? [];
  const initial = childMeta.slice(0, INITIAL_ENTRY_COUNT);
  // allSettled (not all): per-update fixtures may not exist for every id (only
  // 3 LiveBlogUpdateQuery--*.json fixtures committed; production also returns
  // no_posts_found for some ids). Filter to fulfilled+non-null so the page
  // still renders the entries we have.
  const settled = await Promise.allSettled(
    initial.map((meta) =>
      graphqlFetch<UpdateResponse>({
        operationName: 'LiveBlogUpdateQuery',
        variables: {
          postID: Number(meta.id),
          postType: 'liveblog-update',
          preview: '',
          isAmp: false,
        },
      }),
    ),
  );
  const entries = settled
    .filter(
      (r): r is PromiseFulfilledResult<UpdateResponse> =>
        r.status === 'fulfilled' && r.value.posts !== null,
    )
    .map((r) => r.value.posts as LiveBlogUpdate);

  return { shell, entries };
}
