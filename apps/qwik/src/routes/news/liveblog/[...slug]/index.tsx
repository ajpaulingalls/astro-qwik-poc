import { component$ } from '@qwik.dev/core';
import { routeLoader$, type DocumentHead, type RequestEventLoader } from '@qwik.dev/router';
import { GraphqlHttpError } from '../../../../lib/graphql';
import {
  LIVEBLOG_INITIAL_ENTRY_COUNT,
  type LiveBlogChildrenIds,
  type LiveBlogHeaderData,
  type LiveBlogUpdate,
} from '@aje-poc/shared-types';
import { fetchLiveBlogShell, fetchLiveBlogUpdate } from '../../../../lib/liveblog-api';
import { LiveBlogHeader } from '../../../../components/LiveBlogHeader';
import { LiveBlogEntry } from '../../../../components/LiveBlogEntry';
import { LiveBlogUpdater } from '../../../../components/LiveBlogUpdater';

export interface LiveBlogLoaderSuccess {
  slug: string;
  header: LiveBlogHeaderData;
  entries: LiveBlogUpdate[];
  initialChildIds: LiveBlogChildrenIds;
  // Present only when one or more per-update fetches rejected with a non-404
  // error (5xx, network, parse). Carries the post ids that failed so the
  // route can surface a "live updates may be incomplete" banner. Omitted on
  // the happy path so a truthy check at the call site doubles as a degraded
  // predicate. Mirrors apps/astro/src/lib/load-liveblog.ts:LiveBlogPageData.
  degraded?: { failedUpdateIds: number[] };
}

function lastSegment(slug: string): string {
  const parts = slug.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

// Exported for unit tests — `routeLoader$` wraps this directly.
export async function loadLiveBlogData(
  ctx: Pick<RequestEventLoader, 'params' | 'fail'>,
): Promise<LiveBlogLoaderSuccess | { notFound: true; slug: string }> {
  const { params, fail } = ctx;
  const slug = lastSegment(params.slug ?? '');
  let shell;
  try {
    shell = await fetchLiveBlogShell(slug);
  } catch (err) {
    if (err instanceof GraphqlHttpError && err.status === 404) {
      return fail(404, { notFound: true, slug });
    }
    throw err;
  }
  if (shell === null) return fail(404, { notFound: true, slug });

  // Per-update fan-out: childrenMeta carries each entry's post ID. Using
  // allSettled (not all) because individual updates can be deleted between
  // shell-fetch and update-fetch; one missing entry shouldn't 404 the route.
  // Intentionally swallowed: rejected-404 (deleted post) and fulfilled-null
  // (no_posts_found 200). Anything else — 5xx, network, parse — is logged
  // and surfaced via the `degraded` marker so transient upstream failures
  // don't masquerade as missing content.
  const meta = shell.childrenMeta ?? [];
  const targets = meta.slice(0, LIVEBLOG_INITIAL_ENTRY_COUNT).map((m) => Number(m.id));
  const settled = await Promise.allSettled(targets.map(fetchLiveBlogUpdate));
  const entries: LiveBlogUpdate[] = [];
  const failedUpdateIds: number[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]!;
    const id = targets[i]!;
    if (result.status === 'fulfilled') {
      if (result.value !== null) entries.push(result.value);
      continue;
    }
    if (result.reason instanceof GraphqlHttpError && result.reason.status === 404) {
      continue;
    }
    failedUpdateIds.push(id);
    console.error('liveblog-route: per-update fetch failed:', { id, reason: result.reason });
  }

  // Trim to render-needed shape only. Qwik 2 serializes the full loader
  // value into the resume payload, so projecting here directly shrinks
  // what ships to the browser.
  const header: LiveBlogHeaderData = {
    title: shell.title,
    subheading: shell.subheading,
    excerpt: shell.excerpt,
    isLive: shell.isLive,
    date: shell.date,
    featuredImage: shell.featuredImage,
  };
  const base: LiveBlogLoaderSuccess = {
    slug,
    header,
    entries,
    initialChildIds: shell.children,
  };
  if (failedUpdateIds.length > 0) {
    // Slug-context summary so deploy-log triage can trace which liveblog
    // degraded, not just which post ids. Mirrors apps/astro/src/pages/news/
    // liveblog/[...slug].astro's post-loader degraded log.
    console.error('liveblog-route: SSR degraded:', { slug, failedUpdateIds });
    return { ...base, degraded: { failedUpdateIds } };
  }
  return base;
}

export const useLiveBlogData = routeLoader$((ctx) => loadLiveBlogData(ctx));

export default component$(() => {
  const data = useLiveBlogData();
  if ('notFound' in data.value) {
    return <div class="mx-auto max-w-3xl px-4 py-6">Live blog not found: {data.value.slug}</div>;
  }
  const { slug, header, entries, initialChildIds, degraded } = data.value;
  return (
    <article class="mx-auto max-w-3xl px-4 py-6">
      {degraded && (
        <aside
          data-live-blog-degraded
          role="status"
          class="mb-4 rounded border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-900"
        >
          Some updates may be missing right now. Refresh to retry.
        </aside>
      )}
      <LiveBlogHeader header={header} />
      {/* Updater renders ONLY new polled entries; static initial entries
          stay below as plain SSR HTML so they're not duplicated in the
          resume payload's component$ closure. */}
      <LiveBlogUpdater slug={slug} initialChildIds={initialChildIds} />
      <section class="live-blog-entries">
        {entries.map((entry) => (
          <LiveBlogEntry key={entry.id} entry={entry} />
        ))}
      </section>
    </article>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const data = resolveValue(useLiveBlogData);
  if ('notFound' in data) {
    return { title: 'Live blog not found' };
  }
  return {
    title: data.header.title,
    meta: [{ name: 'description', content: data.header.excerpt ?? data.header.subheading ?? '' }],
  };
};
