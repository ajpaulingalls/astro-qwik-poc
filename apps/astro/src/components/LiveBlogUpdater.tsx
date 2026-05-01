import { useEffect, useRef, useState } from 'preact/hooks';
import {
  createPollLoop,
  LIVEBLOG_POLL_INTERVAL_MS,
  MAX_CONSECUTIVE_EMPTY_POLLS,
  POLL_DONE,
  resolvePollIntervalMs,
  type LiveBlogUpdate,
} from '@aje-poc/shared-types';
import { GraphqlHttpError } from '../lib/graphql';
import { fetchLiveBlogShell, fetchLiveBlogUpdate } from '../lib/liveblog-api';
import { LiveBlogEntry } from './LiveBlogEntry';

const POLL_INTERVAL_MS = resolvePollIntervalMs(
  import.meta.env.PUBLIC_LIVEBLOG_POLL_INTERVAL_MS,
  LIVEBLOG_POLL_INTERVAL_MS,
);

// Exported for unit tests. Polls the shell, diffs against currentIds,
// fetches per-update content for any new ids in parallel, and returns the
// fulfilled+non-null entries newest-first. allSettled keeps a single
// no_posts_found from killing the whole batch. Intentionally swallowed:
// rejected-404 (deleted post) and fulfilled-null (no_posts_found 200).
// Anything else — 5xx, network, parse — is logged so a transient upstream
// failure surfaces in the console (the poll site has no UI consumer for a
// degraded marker today; loadLiveBlogData carries the marker on the SSR
// path where the route is a credible UI consumer).
//
// Returns POLL_DONE when the upstream signals end-of-blog: shell === null
// (deleted / no_posts_found) or shell.isLive === false (concluded). The
// tick callsite forwards POLL_DONE to createPollLoop which clears the
// interval immediately, sparing ~10 minutes of wasted polling that the
// max-consecutive-empty safety net would otherwise take to notice.
//
// Returns `[]` (NOT POLL_DONE) when the blog is still live but no new ids
// arrived this cycle — that's a transient empty: more updates may arrive
// next cycle, so the loop should keep polling and only stop after
// MAX_CONSECUTIVE_EMPTY_POLLS consecutive empties (the safety net).
export async function fetchPollUpdate(
  slug: string,
  currentIds: number[],
): Promise<LiveBlogUpdate[] | typeof POLL_DONE> {
  const shell = await fetchLiveBlogShell(slug);
  // End-of-blog: shell deleted (null from 404 / no_posts_found) OR editors
  // flipped isLive false (concluded). Inlined rather than extracted to a
  // shared isLiveBlogActive() predicate — TS narrowing through a boolean
  // helper would force a non-null assertion at the access below; the inline
  // disjunction narrows shell to LiveBlogShell on the green path naturally.
  // Qwik twin (apps/qwik/src/components/LiveBlogUpdater.tsx) duplicates this
  // line — extract to shared-types if a third caller appears (rule of three).
  if (shell === null || shell.isLive === false) return POLL_DONE;
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
  initialChildIds: number[];
}

// SSR renders the initial entries above this island (in the route's static
// map). The Updater holds only NEW polled entries — keeping initial entries
// out of client state protects the route's <60KB JS budget. New entries
// prepend at the top of the section; aria-live announces additions to AT.
//
// CLS-on-prepend defense lives in CSS positioning + e2e measurement
// (story-005 capstone), not skeleton placeholders. Mirrors the Qwik
// teammate's no-skeleton design for cross-app fairness.
export function LiveBlogUpdater({ slug, initialChildIds }: Props) {
  const [newEntries, setNewEntries] = useState<LiveBlogUpdate[]>([]);
  const sectionRef = useRef<HTMLElement>(null);
  // Latest entries kept in a ref so the poll callback always reads the
  // current value without re-arming the interval on every state change.
  const newEntriesRef = useRef<LiveBlogUpdate[]>([]);
  newEntriesRef.current = newEntries;

  useEffect(() => {
    sectionRef.current?.setAttribute('data-hydrated', 'true');
    const { stop } = createPollLoop<LiveBlogUpdate[]>({
      tick: async () => {
        const polled = newEntriesRef.current.map((e) => Number(e.id));
        const known = [...polled, ...initialChildIds];
        const fresh = await fetchPollUpdate(slug, known);
        if (fresh === POLL_DONE) return POLL_DONE;
        return fresh.length === 0 ? null : fresh;
      },
      onResult: (fresh) => setNewEntries((prev) => [...fresh, ...prev]),
      onError: (err) => console.error('liveblog-updater: poll tick failed:', err),
      shouldSkip: () => document.hidden,
      intervalMs: POLL_INTERVAL_MS,
      maxConsecutiveEmpty: MAX_CONSECUTIVE_EMPTY_POLLS,
      label: 'liveblog-updater',
    });
    return stop;
  }, [slug, initialChildIds]);

  return (
    <section
      ref={sectionRef}
      data-live-blog-updater
      data-hydrated="false"
      aria-live="polite"
      aria-relevant="additions"
      class="live-blog-updater"
    >
      {newEntries.map((entry) => (
        <LiveBlogEntry key={entry.id} entry={entry} />
      ))}
    </section>
  );
}
