import { useEffect, useRef, useState } from 'preact/hooks';
import { LIVEBLOG_POLL_INTERVAL_MS, type LiveBlogUpdate } from '@aje-poc/shared-types';
import { GraphqlHttpError } from '../lib/graphql';
import { fetchLiveBlogShell, fetchLiveBlogUpdate } from '../lib/liveblog-api';
import { LiveBlogEntry } from './LiveBlogEntry';

// Build-time poll-cadence override for acceptance tests — Vite inlines
// import.meta.env.PUBLIC_LIVEBLOG_POLL_INTERVAL_MS at build, so production
// builds bake the 30s default unless the build is run with the env set.
// Non-positive / non-finite values fall through to the default.
export function resolvePollIntervalMs(rawEnv: unknown, defaultMs: number): number {
  const n = Number(rawEnv);
  return Number.isFinite(n) && n > 0 ? n : defaultMs;
}
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
export async function fetchPollUpdate(
  slug: string,
  currentIds: number[],
): Promise<LiveBlogUpdate[]> {
  const shell = await fetchLiveBlogShell(slug);
  if (!shell) return [];
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
  // Latest entries kept in a ref so the interval callback always reads the
  // current value without re-arming the interval on every state change.
  const newEntriesRef = useRef<LiveBlogUpdate[]>([]);
  newEntriesRef.current = newEntries;
  // Concurrency guard: if a fetch from tick N stalls past the 30s
  // interval, tick N+1 must NOT fire a second concurrent fetch — the
  // older fetch could resolve last and prepend stale entries above
  // newer ones. Drop the late tick on the floor; the next tick after
  // pollingRef clears picks up the latest known ids. Mirrors the Qwik
  // LiveBlogUpdater guard.
  const pollingRef = useRef(false);

  useEffect(() => {
    sectionRef.current?.setAttribute('data-hydrated', 'true');
    const intervalId = setInterval(async () => {
      if (pollingRef.current) return;
      // Skip background tabs — no point burning the user's battery (and the
      // server) when entries aren't being read. document is always defined
      // here (this useEffect is browser-only).
      if (document.hidden) return;
      pollingRef.current = true;
      try {
        const polled = newEntriesRef.current.map((e) => Number(e.id));
        const known = [...polled, ...initialChildIds];
        const fresh = await fetchPollUpdate(slug, known);
        // Early return is safe: finally clears pollingRef.
        if (fresh.length === 0) return;
        setNewEntries((prev) => [...fresh, ...prev]);
      } catch (err) {
        // fetchLiveBlogShell or any other unhandled awaitable can reject
        // (5xx, network, parse). Without this catch the rejection becomes
        // an unhandled promise rejection at every tick.
        console.error('liveblog-updater: poll tick failed:', err);
      } finally {
        pollingRef.current = false;
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
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
