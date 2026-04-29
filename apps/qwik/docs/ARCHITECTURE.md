# Architecture — Qwik 2 (beta)

> Technical design for the Qwik 2 (beta) implementation.
> For verified production query patterns, see [../../../docs/RESEARCH.md](../../../docs/RESEARCH.md) (shared with Astro PoC).

> **Beta caveat:** Qwik 2 is at `@qwik.dev/core` 2.0.0-beta.32 (April 2026). Stable Qwik is still 1.x (`@builder.io/qwik` 1.19.2). We chose beta intentionally — the production rebuild is months out and we want forward-looking comparison data — but expect occasional rough edges in tooling, plugin compatibility, and docs.

---

## Rendering Model

**Qwik uses resumability instead of hydration.** The server renders HTML and serializes component state into the DOM. The client doesn't re-execute component initialization — it resumes from the serialized state. Interactive handlers are lazy-loaded only when the user triggers them.

For a news site, this is compelling: regardless of how many components are on the page, the initial JS payload is near-zero. A homepage with 17 story cards, a video carousel, and a livestream player ships the same amount of JavaScript as a simple article page — effectively none until interaction.

| Component                | Loading Strategy    | Why                        |
| ------------------------ | ------------------- | -------------------------- |
| `BreakingTicker`         | `useVisibleTask$()` | Starts polling on mount    |
| `LiveBlogUpdater`        | `useVisibleTask$()` | Starts polling on mount    |
| `LoadMoreButton`         | `$()` click handler | Lazy-loaded on first click |
| `VerticalVideoCarousel`  | `$()` handlers      | Lazy-loaded on interaction |
| `VideoPlayer`            | `$()` handlers      | Lazy-loaded on play        |
| `Navigation` (hamburger) | `$()` click handler | Lazy-loaded on tap         |

No island boundaries are needed — Qwik's compiler automatically determines what can be lazy-loaded.

---

## System Overview

```
┌─────────────────────────────────────────────────┐
│                  Browser                        │
│  ┌──────────────────────────────────────┐       │
│  │       Qwik 2 (@qwik.dev/core)        │       │
│  │  Resumable — no hydration cost       │       │
│  │  Handlers lazy-loaded on interaction │       │
│  │  ┌─────┐ ┌─────┐ ┌─────┐           │       │
│  │  │ $() │ │ $() │ │ $() │ ← loaded  │       │
│  │  │     │ │     │ │     │   on use   │       │
│  │  └─────┘ └─────┘ └─────┘           │       │
│  │  Server HTML ████████████████████    │       │
│  └──────────────────┬───────────────────┘       │
└─────────────────────┼───────────────────────────┘
                      │ SSR at request time
                      ▼
┌─────────────────────────────────────────────────┐
│           Mock GraphQL API (Deno)               │
│           GET /graphql?operationName=...        │
│           Header: wp-site: aje                  │
└─────────────────────────────────────────────────┘
```

---

## Qwik 2 platform features in use

| Feature                                                   | Notes                                                                                                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@qwik.dev/core`** (was `@builder.io/qwik`)             | All component / signal / task imports use the new scope                                                                                            |
| **`@qwik.dev/router`** (was `@builder.io/qwik-city`)      | `routeLoader$`, file-based routing, `Form`                                                                                                         |
| **Leaner HTML output**                                    | No comment nodes — smaller payload, helps LCP                                                                                                      |
| **`useAsyncComputed$`**                                   | New reactive async signal — useful for derived data from `routeLoader$` results                                                                    |
| **`useSerializer$`**                                      | Loaders are no longer serialized to the client by default in v2; opt in with this for client-resumable data                                        |
| **`allowStale`** option on `routeLoader$` / `AsyncSignal` | Returns stale data immediately while revalidating — relevant for the breaking ticker and live blog polling                                         |
| **`passive:` / `capture:` event markers**                 | JSX event handlers can opt into passive listeners (e.g. `onTouchstart$={passive: ...}`) — relevant for the vertical video carousel scroll handling |
| **HTML validation**                                       | Enforced at build time (e.g. `<p>` can't contain `<div>`) — catches structural bugs in `ArticleBody.tsx` rich-text rendering                       |

Stable Qwik 2 release is not yet announced; we're following the `@qwik.dev/core` `latest` tag (currently `2.0.0-beta.32`).

---

## Mock GraphQL API

> **Mock GraphQL API.** Shared mock server living in `packages/mock-api/`. Full spec — server implementation, fixtures, recording, env vars, Deno permissions — at [docs/MOCK_API.md](../../../docs/MOCK_API.md). Applies identically to both apps.

---

## GraphQL Client

Qwik's GraphQL client is **isomorphic** — the same module runs on both server (`routeLoader$`) and client (`$()` handlers). The server uses it for initial page data; the client uses it for pagination and polling.

**Note on dev-time vs harness-time mock-api ports.** Standalone development uses port 4455 (`bun run mock-api` + `bun run dev:qwik` — both default 4455). Under the perf-harness and acceptance tests, however, the Qwik target's mock-api lives on **4456** so that test-astro and test-qwik can run in parallel under lefthook without colliding on a single shared listener. The harness handles this by setting `PUBLIC_API_BASE=http://localhost:4456` in the spawned Qwik server's environment; `resolveApiBase` checks `process.env.PUBLIC_API_BASE` on the SSR side and overrides the build-time default. Per-target port map lives in `packages/perf-harness/spawn.ts:MOCK_API_PORT`.

```typescript
// src/lib/graphql.ts
const DEFAULT_API_BASE = 'http://localhost:4455';

function resolveApiBase(): string {
  const fromEnv = import.meta.env?.PUBLIC_API_BASE;
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_API_BASE;
}

interface GraphqlFetchOptions {
  operationName: string;
  variables?: Record<string, unknown>;
  wpSite?: 'aje' | 'aja';
}

export async function graphqlFetch<T>({
  operationName,
  variables = {},
  wpSite = 'aje',
}: GraphqlFetchOptions): Promise<T> {
  const params = new URLSearchParams({
    'wp-site': wpSite,
    operationName,
    variables: JSON.stringify(variables),
    extensions: '{}',
  });

  const response = await fetch(`${resolveApiBase()}/graphql?${params.toString()}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'wp-site': wpSite,
    },
  });

  const json = await response.json();
  return json.data as T;
}
```

### Usage in Route Loaders (Server-Side)

```tsx
// src/routes/index.tsx
import { component$ } from '@qwik.dev/core';
import { routeLoader$ } from '@qwik.dev/router';
import { graphqlFetch } from '../lib/graphql';

export const useHomepageData = routeLoader$(async () => {
  const [homepage, curatedFeed] = await Promise.all([
    graphqlFetch({
      operationName: 'HomePageQuery',
      variables: { isAtf: true, atfLength: 2, slug: '', preview: '' },
    }),
    graphqlFetch({
      operationName: 'HomePageCuratedFeedQuery',
      variables: { preview: '', slug: '' },
    }),
  ]);
  return { homepage, curatedFeed };
});

export default component$(() => {
  const data = useHomepageData();
  return (
    <>
      <HeroCard post={data.value.homepage.homepage.featuredPosts[0]} />
      {/* ... */}
    </>
  );
});
```

### Usage in Client-Side Handlers

```tsx
// src/components/LoadMoreButton.tsx
import { component$, useSignal, $ } from "@qwik.dev/core";
import { graphqlFetch } from "../lib/graphql";

interface Props {
  section: string;
  categoryType: "where" | "topic";
  initialOffset?: number;
}

export const LoadMoreButton = component$<Props>(
  ({ section, categoryType, initialOffset = 9 }) => {
    const offset = useSignal(initialOffset);
    const additionalPosts = useSignal<unknown[]>([]);
    const loading = useSignal(false);

    const loadMore = $(async () => {
      loading.value = true;
      const operationName =
        categoryType === "where"
          ? "ArchipelagoAjeSectionPostsQuery"
          : "ArchipelagoPaginatedTopicsFeedQuery";

      const data = await graphqlFetch({
        operationName,
        variables:
          categoryType === "where"
            ? { category: section, categoryType: "where", quantity: 9, offset: offset.value }
            : { slug: section, quantity: 9, offset: offset.value },
      });

      additionalPosts.value = [...additionalPosts.value, ...data.posts];
      offset.value += 9;
      loading.value = false;
    });

    return (
      <>
        {additionalPosts.value.map((post) => (/* render StoryCard */))}
        <button onClick$={loadMore} disabled={loading.value}>
          {loading.value ? "Loading..." : "Load More"}
        </button>
      </>
    );
  }
);
```

### Polling with `useVisibleTask$`

```tsx
// src/components/BreakingTicker.tsx
import { component$, useSignal, useVisibleTask$ } from '@qwik.dev/core';
import { graphqlFetch } from '../lib/graphql';

export const BreakingTicker = component$(() => {
  const tickerData = useSignal(null);

  useVisibleTask$(({ cleanup }) => {
    const poll = async () => {
      const data = await graphqlFetch({
        operationName: 'ArchipelagoBreakingTickerQuery',
      });
      tickerData.value = data;
    };

    poll(); // initial fetch
    const interval = setInterval(poll, 30_000);
    cleanup(() => clearInterval(interval));
  });

  if (!tickerData.value) return null;
  return <div class="breaking-ticker">{/* render ticker */}</div>;
});
```

> `allowStale` (the v2-shaped cache-revalidate primitive) does **not** exist on `routeLoader$` / `AsyncSignal` in `@qwik.dev/core` ~2.0.0-beta.32 — see `docs/QWIK2_NOTES.md` § "M3 scaffolding > Divergences from apps/qwik/docs/ARCHITECTURE.md", item 3 (the same heading also appears under "M7 article shell" — make sure you land on the M3 one). Manual `setInterval` inside `useVisibleTask$` is the canonical workaround until it lands. Revisit on subsequent beta bumps.

### Live blog polling

The live-blog route splits rendering: initial entries are static SSR HTML emitted by the route, while `LiveBlogUpdater` (`apps/qwik/src/components/LiveBlogUpdater.tsx`, a `component$`) polls every 30s and prepends only new entries. The split keeps initial-entry HTML out of the resume payload's `component$` closure (one less copy) so the route stays under the shared 176KB transfer-size budget (re-anchored at sprint-009 capstone — see `packages/perf-harness/cli_helpers.ts` for the framework-drift rationale).

The load-bearing shape — register `clearInterval` via the visible-task `cleanup` callback so QRL teardown invokes it on unmount:

```ts
useVisibleTask$(({ cleanup }) => {
  const id = setInterval(async () => {
    /* poll, diff, prepend */
  }, 30_000);
  cleanup(() => clearInterval(id));
});
```

Three pieces matter:

1. **`fetchPollUpdate(slug, currentIds)` is exported** from the same file so it can be unit-tested without bootstrapping qwikLoader. createDOM doesn't bootstrap qwikLoader, so `useVisibleTask$` bodies don't fire under vitest — `LoadMoreButton` follows the same helper-extraction pattern.
2. **The route loader trims the shell to a render-needed shape** (`LiveBlogHeaderData` + the initial `LiveBlogUpdate[]` projections) — Qwik 2 serializes the full loader value into the resume payload, so projecting at the loader directly shrinks what ships.
3. CLS-on-prepend verification — Updater renders an `aria-live="polite" aria-relevant="additions"` region; e2e CLS measurement during polling lives in story-005's acceptance suite (createDOM can't fire `useVisibleTask$`, so it isn't unit-testable).

---

## Component Library

In Qwik, there's **no distinction between static and interactive components** at the file level. The compiler handles the splitting. However, the conceptual split matters for understanding what ships JS:

### Purely Static (zero JS shipped)

| Component               | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| `HeroCard.tsx`          | Large featured story card (top story)                    |
| `StoryCard.tsx`         | Standard article card with image, headline, excerpt      |
| `StoryCardCompact.tsx`  | Smaller card variant (sidebar, related)                  |
| `ArticleBody.tsx`       | Rich text renderer — handles embeds, images, pull quotes |
| `MostPopular.tsx`       | Most popular sidebar/module (10 items)                   |
| `CuratedCollection.tsx` | Editorially curated content block                        |
| `Footer.tsx`            | Site footer with link columns                            |

### Interactive (JS lazy-loaded on interaction or mount)

| Component                   | Trigger                   | Description                                                                       |
| --------------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| `BreakingTicker.tsx`        | `useVisibleTask$` (mount) | Polls `ArchipelagoBreakingTickerQuery` every 30s                                  |
| `LoadMoreButton.tsx`        | `$()` (click)             | Triggers offset-based pagination, appends results                                 |
| `LiveBlogUpdater.tsx`       | `useVisibleTask$` (mount) | Polls for new live blog entries                                                   |
| `VerticalVideoCarousel.tsx` | `$()` (swipe/scroll)      | Swipeable vertical video shorts carousel — use `passive:` event marker for scroll |
| `VideoPlayer.tsx`           | `$()` (play)              | Brightcove / YouTube embed                                                        |
| `LivestreamPlayer.tsx`      | `$()` (play)              | Livestream video with config from `livestream` field                              |
| `Navigation.tsx`            | `$()` (click)             | Nav with hamburger menu toggle for mobile                                         |

### Layouts

| Component               | Description                               |
| ----------------------- | ----------------------------------------- |
| `layout.tsx` (root)     | Global wrapper — nav, footer, ticker slot |
| `ThreeColumnLayout.tsx` | Homepage grid layout                      |
| `SectionLayout.tsx`     | Section front layout                      |

---

## Routing

Qwik Router (`@qwik.dev/router`) uses **directory-based routing**:

| Pattern                                      | Route File                                     | Page Type     |
| -------------------------------------------- | ---------------------------------------------- | ------------- |
| `/`                                          | `src/routes/index.tsx`                         | Homepage      |
| `/news/{year}/{month}/{day}/{slug}`          | `src/routes/news/[...slug]/index.tsx`          | Article       |
| `/news/liveblog/{year}/{month}/{day}/{slug}` | `src/routes/news/liveblog/[...slug]/index.tsx` | Live Blog     |
| `/{section}`                                 | `src/routes/[section]/index.tsx`               | Section Front |

### Section Type Resolution

```typescript
import {
  GEOGRAPHIC_SECTIONS,
  GEO_API_CATEGORY_TYPE,
  getSectionType,
  SECTION_PAGE_SIZE,
} from '@aje-poc/shared-types';
// GEOGRAPHIC_SECTIONS allowlist + getSectionType classifier + page-size live in
// the shared-types workspace package — both apps and the perf-harness consume
// the single source of truth (see packages/shared-types/index.ts).
```

- **Geographic** → `ArchipelagoSectionQuery` (ID 64) with `categoryType: GEO_API_CATEGORY_TYPE` (`"where"`)
- **Topic** → `ArchipelagoTopicsPageQuery` (ID 92) with `slug`

---

## Performance Budgets

### Core Web Vitals

The PoC aims to **exceed** the "Good" thresholds, not just clear them. Per-page acceptance criteria use the stretch column; a measured value worse than the floor fails the milestone outright. INP is measured on interactive components via puppeteer-core-driven interactions in the M2 harness; LCP/CLS on all page types under 4G throttling.

> Same stretch targets apply to the Astro PoC — see top-level [README.md](../../../README.md#performance-targets--stretch-goals) for the canonical thresholds table.

> **INP measurement divergence — read before tuning interactive components.** Two distinct INP code paths exist (acceptance-suite click→DOM-mutation proxy vs future real `onINP` capture). The full callout lives in [docs/PERF_INSTRUMENTATION.md § INP measurement divergence](../../../docs/PERF_INSTRUMENTATION.md#inp-measurement-divergence) — applies identically to both apps.

### JavaScript Budgets (Transferred, all script bytes per Lighthouse network-requests)

Qwik 2 beta.32 ships a ~102 KB core runtime + ~5 KB qwikLoader + ~5 KB preloader on first hit, irrespective of page complexity. Handlers and route-specific code lazy-load on interaction. The original `< 15 KB` aspirational targets assumed a mature, hand-tuned production build with a much smaller framework runtime — Qwik 2 beta is ~86% larger than Qwik 1 stable, and the size-optimization pass hasn't landed yet. See [`QWIK2_NOTES.md` § Story-009 framework cost characterization](QWIK2_NOTES.md#story-009-framework-cost-characterization-sprint-005) for the full chunk-by-chunk breakdown.

| Page              | JS Target   | Aspirational (Qwik 2 stable) | Notes                                                                                                                                |
| ----------------- | ----------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Homepage**      | **<176 KB** | <15 KB                       | Sprint-009 capstone re-anchor from <175 KB (framework-runtime drift in beta line, +1-3 KB across routes with no source-code changes) |
| **Article**       | **<176 KB** | <10 KB                       | Sprint-009 capstone re-anchor — shares Homepage ceiling (per-app-code differences are in framework-drift noise floor)                |
| **Live Blog**     | **<176 KB** | <20 KB                       | Sprint-009 capstone re-anchor — shares Homepage ceiling (Updater QRL chunk is ~500B, in framework-drift noise floor)                 |
| **Section Front** | **<176 KB** | <15 KB                       | Ships same bundle as Homepage (per cli_helpers.ts comment); shares Homepage ceiling                                                  |

Sprint-009 re-budget rationale: the +10–13 KB Homepage/Article gap to the prior ceilings is framework+router growth, not app code (102 KB Qwik core + 12 KB router+zod + 7 KB router internals + 5 KB qwikLoader + 5 KB preloader + 5 KB web-vitals = ~136 KB before any app symbol). Story-005 audit, leaf-component refactor (4 of 5 candidates, -558 bytes), and bisect all confirmed: the regression is not in user code. See [`QWIK2_NOTES.md` § Story-009 framework cost characterization](QWIK2_NOTES.md#story-009-framework-cost-characterization-sprint-005) for the irreducibility argument and [§ sprint-008 story-005](QWIK2_NOTES.md#sprint-008--story-005--article-js-budget-audit--framework-graph-regression-2026-04-27) for the regression audit.

Re-budget when Qwik 2 stable ships — likely ~75–100 KB for Homepage if the v2 stable core matches v1's 54 KB. See [`QWIK2_NOTES.md` § sprint-006 — JS budget revision](QWIK2_NOTES.md#sprint-006--js-budget-revision-150kb--165kb) for the prior revision rationale.

### SSR Performance & Lighthouse Scores

> **SSR throughput targets and Lighthouse category scores** (Performance / Accessibility / Best Practices / SEO) are framework-agnostic. Full table — including the per-target Performance split (Astro ≥ 98, Qwik ≥ 80 floor — re-anchored at sprint-009 capstone) — at [docs/PERFORMANCE_TARGETS.md](../../../docs/PERFORMANCE_TARGETS.md). Applies identically to both apps.

---

## Styling

**Tailwind CSS 4** with shared design tokens:

- Colors, typography, spacing as CSS custom properties
- Responsive breakpoints: mobile-first, tablet 768px, desktop 1024px, wide 1280px
- Dark mode: not in PoC scope

Web fonts loaded via standard Vite asset pipeline (Qwik 2 doesn't have a built-in equivalent of Astro's Fonts API — manual `<link rel="preload">` + `font-display: swap` + `size-adjust` declarations needed for CLS protection).

---

## Testing

### Unit Tests — Vitest

- GraphQL client utility
- Section type resolution
- Component rendering (where applicable)

### Integration Tests — puppeteer-core

- Page loads and renders content for all four page types
- Interactive components work (Load More, nav toggle, ticker)
- Responsive layout at mobile / tablet / desktop

### Performance Tests

Run via the shared **`packages/perf-harness/`** (built in M2). Same harness drives both the Astro and Qwik apps for apples-to-apples data:

- Drives interactions via puppeteer-core (so INP is captured)
- Runs Lighthouse against the resulting state
- Aggregates n ≥ 5 runs per page (CWV are noisy)
- Outputs a structured report consumable by the comparison report (M10)

Web Vitals are instrumented via the `web-vitals` JS library (mirrored in the Astro app for definition consistency). Bundle size analysis vs the per-page budgets above is part of M9.
