import { component$, useSignal, useVisibleTask$ } from '@qwik.dev/core';
import {
  LIVEBLOG_POLL_INTERVAL_MS,
  type LiveBlogChildrenIds,
  type LiveBlogUpdate,
} from '@aje-poc/shared-types';
import { fetchLiveBlogShell, fetchLiveBlogUpdate } from '../lib/liveblog-api';
import { LiveBlogEntry } from './LiveBlogEntry';

// Exported for unit tests — see LiveBlogUpdater.test.tsx header for the
// qwikLoader/createDOM rationale that forces helper-extraction.
export async function fetchPollUpdate(
  slug: string,
  currentIds: LiveBlogChildrenIds,
): Promise<LiveBlogUpdate[]> {
  const shell = await fetchLiveBlogShell(slug);
  const known = new Set(currentIds);
  const newIds = shell.children.filter((id) => !known.has(id));
  if (newIds.length === 0) return [];
  const settled = await Promise.allSettled(newIds.map(fetchLiveBlogUpdate));
  return settled
    .filter((s): s is PromiseFulfilledResult<LiveBlogUpdate> => s.status === 'fulfilled')
    .map((s) => s.value);
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

  // routeLoader$ is not re-invoked from the client without a navigation,
  // so polling lives here as a manual setInterval inside useVisibleTask$.
  // allowStale (the v2-shaped equivalent) does not exist in beta.32 —
  // see apps/qwik/docs/QWIK2_NOTES.md for the recorded decision. clearInterval
  // MUST be registered via the visible-task `cleanup` callback (not from
  // inside the setInterval body) so QRL teardown invokes it on unmount.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const intervalId = setInterval(async () => {
      // Skip background tabs — no point burning the user's battery (and the
      // server) when the entries aren't being read. useVisibleTask$ is
      // client-only, so document is always defined here.
      if (document.hidden) return;
      const polledIds = newEntries.value.map((e) => Number(e.id));
      const known = [...polledIds, ...initialChildIds];
      const fresh = await fetchPollUpdate(slug, known);
      if (fresh.length === 0) return;
      newEntries.value = [...fresh, ...newEntries.value];
    }, LIVEBLOG_POLL_INTERVAL_MS);
    cleanup(() => clearInterval(intervalId));
  });

  return (
    <section
      data-live-blog-updater
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
