import { component$, useSignal, useVisibleTask$ } from '@qwik.dev/core';
import {
  LIVEBLOG_POLL_INTERVAL_MS,
  resolvePollIntervalMs,
  type LiveBlogChildrenIds,
  type LiveBlogUpdate,
} from '@aje-poc/shared-types';
import { GraphqlHttpError } from '../lib/graphql';
import { fetchLiveBlogShell, fetchLiveBlogUpdate } from '../lib/liveblog-api';
import { LiveBlogEntry } from './LiveBlogEntry';

const POLL_INTERVAL_MS = resolvePollIntervalMs(
  import.meta.env.PUBLIC_LIVEBLOG_POLL_INTERVAL_MS,
  LIVEBLOG_POLL_INTERVAL_MS,
);

// Exported for unit tests — see LiveBlogUpdater.test.tsx header for the
// qwikLoader/createDOM rationale that forces helper-extraction.
//
// Intentionally swallowed: rejected-404 (deleted post / no_posts_found).
// Anything else — 5xx, network, parse — is logged so a transient upstream
// failure surfaces in the console. The poll site has no UI consumer for a
// degraded marker today; loadLiveBlogData (Astro side) carries the marker
// on the SSR path where the route is a credible UI consumer.
export async function fetchPollUpdate(
  slug: string,
  currentIds: LiveBlogChildrenIds,
): Promise<LiveBlogUpdate[]> {
  const shell = await fetchLiveBlogShell(slug);
  if (shell === null) return [];
  const known = new Set(currentIds);
  const newIds = shell.children.filter((id) => !known.has(id));
  if (newIds.length === 0) return [];
  const settled = await Promise.allSettled(newIds.map(fetchLiveBlogUpdate));
  const entries: LiveBlogUpdate[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]!;
    const id = newIds[i]!;
    if (result.status === 'fulfilled') {
      if (result.value !== null) entries.push(result.value);
      continue;
    }
    if (result.reason instanceof GraphqlHttpError && result.reason.status === 404) {
      continue;
    }
    console.error('liveblog-updater: per-update fetch failed:', { id, reason: result.reason });
  }
  return entries;
}

interface Props {
  slug: string;
  initialChildIds: LiveBlogChildrenIds;
}

export const LiveBlogUpdater = component$<Props>(({ slug, initialChildIds }) => {
  // Only NEW polled entries live in this signal. Initial entries are
  // server-rendered once by the route's static map — keeping them out of
  // the resume payload's component$ closure protects the route's <20KB JS
  // budget.
  const newEntries = useSignal<LiveBlogUpdate[]>([]);
  // Mirrors the Astro Updater's data-hydrated marker so the perf-harness
  // acceptance suite has a single cross-app signal for "Updater is alive"
  // instead of a target-specific OR fallback. Flips false→true once the
  // visible-task arms.
  const hydrated = useSignal(false);

  // routeLoader$ is not re-invoked from the client without a navigation,
  // so polling lives here as a manual setInterval inside useVisibleTask$.
  // allowStale (the v2-shaped equivalent) does not exist in beta.32 —
  // see apps/qwik/docs/QWIK2_NOTES.md for the recorded decision. clearInterval
  // MUST be registered via the visible-task `cleanup` callback (not from
  // inside the setInterval body) so QRL teardown invokes it on unmount.
  //
  // strategy: 'document-ready' (not the default 'intersection-observer')
  // because the section starts empty (0 height) — IntersectionObserver
  // doesn't reliably fire for 0-height elements in headless Chrome and
  // would leave the Updater dormant for users who landed at the top.
  // Polling should start as soon as the document is ready, mirroring the
  // Astro Updater's useEffect behavior for cross-app fairness.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    ({ cleanup }) => {
      hydrated.value = true;
      // Concurrency guard: if a fetch from tick N stalls past the 30s
      // interval, tick N+1 must NOT fire a second concurrent fetch — the
      // older fetch could resolve last and prepend stale entries above
      // newer ones. Drop the late tick on the floor; the next tick after
      // `polling` clears will pick up the latest known ids. Production
      // upgrade path: AbortController + sequence number to actively
      // cancel the stalled fetch.
      let polling = false;
      const intervalId = setInterval(async () => {
        if (polling) return;
        // Skip background tabs — no point burning the user's battery (and the
        // server) when the entries aren't being read. useVisibleTask$ is
        // client-only, so document is always defined here.
        if (document.hidden) return;
        polling = true;
        try {
          const polledIds = newEntries.value.map((e) => Number(e.id));
          const known = [...polledIds, ...initialChildIds];
          const fresh = await fetchPollUpdate(slug, known);
          // Early return is safe: finally clears polling.
          if (fresh.length === 0) return;
          newEntries.value = [...fresh, ...newEntries.value];
        } catch (err) {
          // fetchLiveBlogShell or any other unhandled awaitable can reject
          // (5xx, network, parse). Without this catch the rejection becomes
          // an unhandled promise rejection at every tick. The `finally`
          // still resets polling so the next tick proceeds.
          console.error('liveblog-updater: poll tick failed:', err);
        } finally {
          polling = false;
        }
      }, POLL_INTERVAL_MS);
      cleanup(() => clearInterval(intervalId));
    },
    { strategy: 'document-ready' },
  );

  return (
    <section
      data-live-blog-updater
      data-hydrated={hydrated.value ? 'true' : 'false'}
      aria-live="polite"
      aria-relevant="additions"
      class="live-blog-updater"
    >
      {newEntries.value.map((entry) => (
        <LiveBlogEntry key={entry.id} entry={entry} />
      ))}
    </section>
  );
});
