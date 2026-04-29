import { useEffect, useRef, useState } from 'preact/hooks';
import type { LiveBlogUpdate } from '@aje-poc/shared-types';
import { fetchLiveBlogShell, fetchLiveBlogUpdate } from '../lib/liveblog-api';
import { LiveBlogEntry } from './LiveBlogEntry';

const POLL_INTERVAL_MS = 30_000;

// Exported for unit tests. Polls the shell, diffs against currentIds,
// fetches per-update content for any new ids in parallel, and returns the
// fulfilled+non-null entries newest-first. allSettled keeps a single
// no_posts_found from killing the whole batch (production occasionally
// returns 404 between shell-fetch and update-fetch).
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
  return settled
    .filter(
      (s): s is PromiseFulfilledResult<LiveBlogUpdate> =>
        s.status === 'fulfilled' && s.value !== null,
    )
    .map((s) => s.value);
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

  useEffect(() => {
    sectionRef.current?.setAttribute('data-hydrated', 'true');
    const intervalId = setInterval(async () => {
      // Skip background tabs — no point burning the user's battery (and the
      // server) when entries aren't being read. document is always defined
      // here (this useEffect is browser-only).
      if (document.hidden) return;
      const polled = newEntriesRef.current.map((e) => Number(e.id));
      const known = [...polled, ...initialChildIds];
      const fresh = await fetchPollUpdate(slug, known);
      if (fresh.length === 0) return;
      setNewEntries((prev) => [...fresh, ...prev]);
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
