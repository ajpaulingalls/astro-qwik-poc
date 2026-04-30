// Consolidation target for cross-app shared types and section-routing
// constants. Previously duplicated under apps/{astro,qwik}/src/lib/
// (homepage-types.ts, section-type.ts). Both apps import from here.

export interface HomepageImage {
  sourceUrl: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface HomepagePost {
  id: string;
  title: string;
  excerpt?: string;
  link: string;
  postType?: string;
  isLive?: boolean;
  isBreaking?: boolean;
  featuredImage?: HomepageImage | null;
  replacementHeadline?: string;
}

// The fields a card component (StoryCard, HeroCard, MostPopular,
// CuratedCollection) actually reads. Used as Props.post type so the
// component's read contract is documented at the boundary; routeLoaders
// today still return full HomepagePost arrays (assignable to this type
// because every required field of StoryCardData is present on
// HomepagePost). If a future routeLoader optimization wants to project
// down to this shape at the data boundary, the target type already exists.
export type StoryCardData = Pick<
  HomepagePost,
  'id' | 'title' | 'excerpt' | 'link' | 'isLive' | 'featuredImage' | 'replacementHeadline'
>;

export interface CuratedCollectionItem {
  title: string;
  overrideLink?: string;
  posts: HomepagePost[];
}

export interface VerticalVideo {
  id: string;
  name: string;
  thumbnail: string;
  poster?: string;
  duration?: string;
  accountId: string;
}

export interface Livestream {
  accountId: string;
  playerID: string;
  videoID: string;
  title: string;
  source?: string;
  bcPlaybackUrl?: string;
  featuredImage?: HomepageImage | null;
}

export interface ArticleAuthor {
  name: string;
  link?: string;
}

export interface ArticleCategory {
  name: string;
  link: string;
  slug: string;
}

export interface Article {
  id: string;
  title: string;
  link: string;
  subheading?: string;
  excerpt?: string;
  replacementHeadline?: string;
  date: string;
  content: string;
  author: ArticleAuthor[];
  categories: ArticleCategory[];
  featuredImage?: HomepageImage | null;
}

export interface LiveBlogChildMeta {
  id: string;
  publishedTime: string;
}

// shouldDisplayTitle: production sometimes returns updates whose title is
// internal-only (e.g., a tweet-only entry); honored by LiveBlogEntry.
// content: trusted CMS HTML carrying Twitter/Brightcove/YouTube/gallery
// embeds — must be dispatched via ArticleBody/parseEmbeds, not raw-injected.
export interface LiveBlogUpdate {
  id: string;
  title: string;
  shouldDisplayTitle: boolean;
  content: string;
  date: string;
}

export type LiveBlogChildrenIds = number[];

// Live-blog poll cadence — both apps' Updaters arm a setInterval at this
// rate. M9 spec target; not a production-observed cadence (RESEARCH.md
// §Live Blog).
export const LIVEBLOG_POLL_INTERVAL_MS = 30_000;

// Test-fixture slug — the live-blog fixture filename suffix (last segment
// of the production URL). Single source of truth for mock-api tests
// (packages/mock-api/tests/_helpers.ts) and shared-types tests
// (packages/shared-types/liveblog-shell.test.ts), both of which load the
// matching ArchipelagoSingleLiveBlogQuery--{slug}--snapshot-0.json fixture.
// NOT used by application code; production resolves slugs via routing.
export const LIVE_BLOG_SLUG =
  'iran-war-live-trump-says-ceasefire-extended-as-talks-with-tehran-in-limbo';

// Stop polling after this many consecutive empty fetchPollUpdate responses.
// Guards against indefinite polling when the live blog is deleted or
// otherwise stops producing new entries — server returns [] forever, costing
// battery + a request every cadence. 20 cycles ≈ 10 minutes at the 30s
// production cadence: long enough that a real lull (no new entries during a
// quiet period) doesn't trip it, short enough to bound waste after deletion.
export const MAX_CONSECUTIVE_EMPTY_POLLS = 20;

export interface PollLoopOptions<T> {
  // Returns the polled value, or `null` if "empty" (no new entries / no
  // active banner). Empty results increment the consecutive-empty counter;
  // throwing also counts as empty per the deletion-guard intent (perpetual
  // 5xx is also a signal to stop).
  tick: () => Promise<T | null>;
  // Called with the polled value when tick returns non-null. Reset point
  // for the consecutive-empty counter.
  onResult: (value: T) => void;
  // Optional callback for null results — used by callers (e.g. BreakingTicker)
  // that need to clear displayed state on the active→null transition.
  // Errors do NOT trigger this (they're typically transient and shouldn't
  // wipe state); use onError for error logging instead.
  onEmpty?: () => void;
  // Optional logger for thrown errors (e.g. to console.error with a prefix).
  // The thrown error itself increments the empty counter regardless.
  onError?: (err: unknown) => void;
  // Optional skip predicate run before each tick (e.g. document.hidden).
  // When true, the tick is dropped on the floor without incrementing
  // either counter.
  shouldSkip?: () => boolean;
  intervalMs: number;
  maxConsecutiveEmpty: number;
  // Used in the single console.info logged when the loop stops.
  label: string;
  // Call tick once synchronously before arming setInterval — so callers
  // that want the first paint populated (e.g. BreakingTicker) don't have
  // to wait one full cadence for the first result.
  immediate?: boolean;
}

// Self-clearing poll loop with built-in concurrency guard, document.hidden
// honoring (via shouldSkip), and a consecutive-empty / consecutive-error
// stop heuristic. Used by every polling island (LiveBlogUpdater +
// BreakingTicker, both apps). Returns a stop() the caller wires to its
// framework's cleanup callback.
export function createPollLoop<T>(opts: PollLoopOptions<T>): { stop: () => void } {
  let polling = false;
  let consecutiveEmpty = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const stop = (): void => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
  const recordEmpty = (): void => {
    consecutiveEmpty++;
    if (consecutiveEmpty >= opts.maxConsecutiveEmpty) {
      console.info(`${opts.label}: stopping poll after ${opts.maxConsecutiveEmpty} empty cycles`);
      stop();
    }
  };
  const tickOnce = async (): Promise<void> => {
    if (polling) return;
    if (opts.shouldSkip?.()) return;
    polling = true;
    try {
      const value = await opts.tick();
      if (value === null) {
        opts.onEmpty?.();
        recordEmpty();
        return;
      }
      consecutiveEmpty = 0;
      opts.onResult(value);
    } catch (err) {
      opts.onError?.(err);
      recordEmpty();
    } finally {
      polling = false;
    }
  };
  if (opts.immediate) void tickOnce();
  intervalId = setInterval(tickOnce, opts.intervalMs);
  return { stop };
}

// Above-the-fold entries the routes fetch in parallel during SSR.
// Production's iran-war live blog has ~128 children; 5 is what shows above
// the fold, with "Load older" deferred to a future story.
export const LIVEBLOG_INITIAL_ENTRY_COUNT = 5;

export interface LiveBlogShell {
  id: string;
  title: string;
  link: string;
  slug: string;
  subheading?: string;
  excerpt?: string;
  replacementHeadline?: string;
  date: string;
  content: string;
  author: ArticleAuthor[];
  categories: ArticleCategory[];
  featuredImage?: HomepageImage | null;
  postType: 'liveblog';
  isLive: boolean;
  isBreaking?: boolean;
  children: LiveBlogChildrenIds;
  childrenMeta?: LiveBlogChildMeta[];
}

// Render-needed projection of LiveBlogShell consumed by LiveBlogHeader in
// both apps. Qwik's routeLoader projects the shell down to this shape so
// the larger LiveBlogShell doesn't enter the resume payload; Astro mirrors
// the projection to keep the component contract identical across apps.
// Encoded as Pick so a future drift in LiveBlogShell.featuredImage (etc.)
// propagates here automatically instead of silently desyncing.
export type LiveBlogHeaderData = Pick<
  LiveBlogShell,
  'title' | 'subheading' | 'excerpt' | 'isLive' | 'date' | 'featuredImage'
>;

// Production response shape for ArchipelagoBreakingTickerQuery (every page
// polls this). All five carriers nullable: snapshot-0 is the empty no-banner
// state, populated snapshots set them all. Verified against the
// ArchipelagoBreakingTickerQuery fixtures under packages/mock-api/fixtures/.
export interface BreakingTickerPost {
  id: string;
  title: string;
  link: string;
}

export interface BreakingTicker {
  post: BreakingTickerPost | null;
  tickerTitle: string | null;
  tickerText: string | null;
  modified: string | null;
  link: string | null;
}

// Both apps' BreakingTicker islands arm setInterval at this rate.
export const TICKER_POLL_INTERVAL_MS = 30_000;

// Build-time poll-cadence override for acceptance tests — Vite inlines
// import.meta.env.PUBLIC_LIVEBLOG_POLL_INTERVAL_MS at build, so production
// builds bake the default unless the env is set. Pure helper shared by both
// LiveBlogUpdater (apps/{astro,qwik}/src/components/LiveBlogUpdater.tsx) and
// BreakingTicker (apps/{astro,qwik}/src/components/BreakingTicker.tsx); single
// env var controls both pollers because their cadences are identical (30s).
// Non-positive / non-finite values fall through to the default.
export function resolvePollIntervalMs(rawEnv: unknown, defaultMs: number): number {
  const n = Number(rawEnv);
  return Number.isFinite(n) && n > 0 ? n : defaultMs;
}

// Banner render gate. Empty or whitespace-only tickerText is treated as
// inactive (defensive: avoids rendering an empty banner if the API ever
// returns "" or "   " instead of null). Only the all-null no-banner shape
// is verified in fixtures; the whitespace branch is a guard, not an
// observed production behavior.
export function isBreakingTickerActive(ticker: BreakingTicker | null): boolean {
  return (
    ticker !== null && typeof ticker.tickerText === 'string' && ticker.tickerText.trim().length > 0
  );
}

// Shared so a copy edit in one app can't silently drift from the other.
export const LIVEBLOG_DEGRADED_BANNER_TEXT =
  'Some updates may be missing right now. Refresh to retry.';

// Production routes /{section} as either a geographic section (apps/{astro,
// qwik}/docs/ARCHITECTURE.md §Section Type Resolution) or a topic page. The
// allowlist is the only authority for the geographic branch — slugs not in
// it are treated as topics, and 404 is decided by fixture/live presence at
// fetch time.
export const GEOGRAPHIC_SECTIONS = [
  'middle-east',
  'asia-pacific',
  'us-canada',
  'europe',
  'africa',
  'latin-america',
] as const;

export type SectionType = 'geographic' | 'topic';

export function getSectionType(slug: string): SectionType {
  return (GEOGRAPHIC_SECTIONS as readonly string[]).includes(slug) ? 'geographic' : 'topic';
}

// Production page-size for section feeds (initial render and each LoadMore
// click). Mirrored in mock-api fixtures and perf-harness acceptance tests.
export const SECTION_PAGE_SIZE = 9;

// API value of `categoryType` for geographic sections. Internal vocabulary
// is 'geographic'/'topic' (SectionType); production GraphQL expects 'where'.
// Mapped at the API boundary by the section route + LoadMoreButton in each app.
export const GEO_API_CATEGORY_TYPE = 'where';
