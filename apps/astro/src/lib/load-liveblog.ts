import {
  LIVEBLOG_INITIAL_ENTRY_COUNT,
  type LiveBlogShell,
  type LiveBlogUpdate,
} from '@aje-poc/shared-types';
import { GraphqlHttpError } from './graphql';
import { fetchLiveBlogShell, fetchLiveBlogUpdate } from './liveblog-api';

export interface LiveBlogPageData {
  shell: LiveBlogShell;
  entries: LiveBlogUpdate[];
  // Present only when one or more per-update fetches rejected with a non-404
  // error (5xx, network, parse). Carries the meta ids that failed so callers
  // can surface a "live updates may be incomplete" banner. Omitted on the
  // happy path so a truthy check at the call site doubles as a degraded
  // predicate.
  degraded?: { failedUpdateIds: number[] };
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
  const initial = childMeta.slice(0, LIVEBLOG_INITIAL_ENTRY_COUNT);
  // allSettled (not all): per-update fixtures may not exist for every id (only
  // 3 LiveBlogUpdateQuery--*.json fixtures committed; production also returns
  // no_posts_found for some ids). Intentionally swallowed: rejected-404
  // (deleted post) and fulfilled-null (no_posts_found 200). Anything else —
  // 5xx, network, parse — is logged and surfaced via the `degraded` marker so
  // a transient upstream failure doesn't masquerade as missing content.
  const settled = await Promise.allSettled(
    initial.map((meta) => fetchLiveBlogUpdate(Number(meta.id))),
  );
  const entries: LiveBlogUpdate[] = [];
  const failedUpdateIds: number[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]!;
    const id = Number(initial[i]!.id);
    if (result.status === 'fulfilled') {
      if (result.value !== null) entries.push(result.value);
      continue;
    }
    if (result.reason instanceof GraphqlHttpError && result.reason.status === 404) {
      continue;
    }
    failedUpdateIds.push(id);
    console.error('load-liveblog: per-update fetch failed:', { id, reason: result.reason });
  }

  return failedUpdateIds.length > 0
    ? { shell, entries, degraded: { failedUpdateIds } }
    : { shell, entries };
}
