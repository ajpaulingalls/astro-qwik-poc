# Architecture — Astro 6 + Preact

> Technical design for the Astro 6 implementation with Preact islands.
> For verified production query patterns, see [../../../docs/RESEARCH.md](../../../docs/RESEARCH.md) (shared with Qwik PoC).

---

## Rendering Model

**Astro ships zero JavaScript by default.** Pages are rendered to static HTML at request time (SSR mode) or build time (SSG). Interactive components are explicitly opted in as **Preact islands** using `client:` directives.

For a news site, this is ideal: the vast majority of content (articles, story cards, layouts, footers) is static HTML. Only a handful of components need interactivity:

| Component                | Directive        | Why                                                |
| ------------------------ | ---------------- | -------------------------------------------------- |
| `BreakingTicker`         | `client:idle`    | Needs to poll immediately after page load          |
| `LiveBlogUpdater`        | `client:idle`    | Needs to poll for new entries                      |
| `LoadMoreButton`         | `client:idle`    | Prewarm hydration so first click meets INP <=100ms |
| `VerticalVideoCarousel`  | `client:visible` | Only hydrate when scrolled into view               |
| `VideoPlayer`            | `client:visible` | Only hydrate when scrolled into view               |
| `Navigation` (hamburger) | `client:idle`    | Menu toggle needed on mobile                       |

Each island hydrates independently — a failing video player doesn't block the ticker.

### Why client islands and not server islands?

Astro 6 supports **server islands** — components rendered out-of-band on the server with their own cache TTL, deferred from the initial HTML response and streamed in afterward. They're an excellent fit for personalized or expensive-but-cacheable content (logged-in user state, recommendations).

For this PoC we deliberately stuck with client islands because every interactive component above either:

- needs **true client-side interactivity** (carousel swipe, hamburger toggle, video playback), or
- needs **client-controlled polling at a custom cadence** (ticker every 30s, live blog updater)

Server islands would still hit the GraphQL API on each render, would need server-side cache invalidation to stay fresh, and would add coordination complexity without buying anything for these specific use cases. We're noting this so future-us doesn't relitigate the decision.

---

## System Overview

```
┌─────────────────────────────────────────────────┐
│                  Browser                        │
│  ┌──────────────────────────────────────┐       │
│  │         Astro 6 + Preact             │       │
│  │  ┌────────┐ ┌────────┐ ┌────────┐   │       │
│  │  │ Island │ │ Island │ │ Island │   │       │
│  │  │Ticker  │ │LoadMore│ │Video   │   │       │
│  │  └────────┘ └────────┘ └────────┘   │       │
│  │  Static HTML ████████████████████    │       │
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

## Runtime & Tooling

The PoC intentionally splits package management, dev runtime, and production runtime:

| Concern          | Tool                                                                                   | Why                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Package manager  | **bun**                                                                                | Fast install, drop-in `package.json` compatibility                                                        |
| Dev server       | **bun** running `astro dev`                                                            | Vite-based dev tooling has the smoothest path on a Node-compatible runtime                                |
| Production SSR   | **Deno 2** via [`@deno/astro-adapter`](https://github.com/denoland/deno-astro-adapter) | Permission model constrains the request-time runtime to only the network and filesystem it actually needs |
| Mock GraphQL API | **Deno 2**                                                                             | Independent process; same security story (see [Mock GraphQL API](#mock-graphql-api))                      |

**Why not run `astro dev` on Deno too?** Astro 6's `astro dev` rewrite uses **Vite's Environment API** to run the production runtime in dev — Deno is officially supported, so this is now technically viable (it wasn't smooth in earlier Astro versions). We still default to bun for dev as a convenience: it sidesteps the per-script permission-flag setup for an environment where the security gain is marginal anyway, since dev tooling (Vite, Tailwind, TS compiler) already needs broad permissions. The security win that matters lives at **request time in production**, where `@deno/astro-adapter` lets the SSR server run with narrow `--allow-net=...` and `--allow-read=./dist` flags. Switching dev to Deno is a one-line config change later if dev/prod parity becomes a concern.

**Pinned versions:**

| Package               | Version  | Notes                            |
| --------------------- | -------- | -------------------------------- |
| `astro`               | `^6.1.0` | Latest stable as of April 2026   |
| `@deno/astro-adapter` | `^0.4.0` | Peer-deps `astro: ^6.0.0`        |
| Deno                  | `2.x`    | Mock API + production SSR        |
| bun                   | `1.x`    | Package management + dev scripts |

**Production start command (illustrative — exact entry path depends on adapter output):**

```bash
deno run \
  --allow-net=0.0.0.0:8080 \
  --allow-read=./dist \
  --allow-env \
  ./dist/server/entry.mjs
```

---

## Mock GraphQL API

> **Mock GraphQL API.** Shared mock server living in `packages/mock-api/`. Full spec — server implementation, fixtures, recording, env vars, Deno permissions — at [docs/MOCK_API.md](../../../docs/MOCK_API.md). Applies identically to both apps.

---

## GraphQL Client

All data fetching happens in `.astro` page frontmatter — **server-side only**. The client (Preact islands) only makes GraphQL calls for pagination and polling.

```typescript
// src/lib/graphql.ts
const API_BASE = import.meta.env.PUBLIC_API_BASE || 'http://localhost:4455';

interface GraphQLOptions {
  operationName: string;
  variables?: Record<string, any>;
  wpSite?: 'aje' | 'aja';
}

export async function graphqlFetch<T>({
  operationName,
  variables = {},
  wpSite = 'aje',
}: GraphQLOptions): Promise<T> {
  const params = new URLSearchParams({
    'wp-site': wpSite,
    operationName,
    variables: JSON.stringify(variables),
    extensions: '{}',
  });

  const response = await fetch(`${API_BASE}/graphql?${params}`, {
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

### Usage in Astro Pages

```astro
---
// src/pages/index.astro — frontmatter (server-side only)
import { graphqlFetch } from '../lib/graphql';
import BaseLayout from '../layouts/BaseLayout.astro';
import HeroCard from '../components/HeroCard.astro';
import BreakingTicker from '../components/islands/BreakingTicker.tsx';

const homepage = await graphqlFetch({
  operationName: 'HomePageQuery',
  variables: { isAtf: true, atfLength: 2, slug: '', preview: '' },
});

const curatedFeed = await graphqlFetch({
  operationName: 'HomePageCuratedFeedQuery',
  variables: { preview: '', slug: '' },
});
---

<BaseLayout>
  <BreakingTicker client:idle />
  <HeroCard post={homepage.homepage.featuredPosts[0]} />
  <!-- ... -->
</BaseLayout>
```

### Usage in Preact Islands (Client-Side)

```tsx
// src/components/islands/LoadMoreButton.tsx
import { useState } from "preact/hooks";

const API_BASE = import.meta.env.PUBLIC_API_BASE || "http://localhost:4455";

export default function LoadMoreButton({ section, categoryType, initialOffset = 9 }) {
  const [offset, setOffset] = useState(initialOffset);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    setLoading(true);
    const operationName = categoryType === "where"
      ? "ArchipelagoAjeSectionPostsQuery"
      : "ArchipelagoPaginatedTopicsFeedQuery";

    const params = new URLSearchParams({
      "wp-site": "aje",
      operationName,
      variables: JSON.stringify({
        ...(categoryType === "where"
          ? { category: section, categoryType: "where", quantity: 9, offset }
          : { slug: section, quantity: 9, offset }),
      }),
      extensions: "{}",
    });

    const res = await fetch(`${API_BASE}/graphql?${params}`, {
      headers: { "wp-site": "aje" },
    });
    const data = await res.json();
    // Append new posts, increment offset
    setPosts((prev) => [...prev, ...data.data.posts]);
    setOffset((prev) => prev + 9);
    setLoading(false);
  };

  return (
    <>
      {posts.map((post) => (/* render StoryCard */))}
      <button onClick={loadMore} disabled={loading}>
        {loading ? "Loading..." : "Load More"}
      </button>
    </>
  );
}
```

---

## Component Library

### Static Components (`.astro` — zero JS)

| Component                 | Description                                                   |
| ------------------------- | ------------------------------------------------------------- |
| `BaseLayout.astro`        | Global wrapper — nav, footer, ticker slot                     |
| `Navigation.astro`        | Hardcoded top nav (static part) + island for hamburger toggle |
| `Footer.astro`            | Site footer with link columns                                 |
| `ThreeColumnLayout.astro` | Homepage grid layout                                          |
| `SectionLayout.astro`     | Section front layout                                          |
| `HeroCard.astro`          | Large featured story card (top story)                         |
| `StoryCard.astro`         | Standard article card with image, headline, excerpt           |
| `StoryCardCompact.astro`  | Smaller card variant (sidebar, related)                       |
| `ArticleBody.astro`       | Rich text renderer — handles embeds, images, pull quotes      |
| `MostPopular.astro`       | Most popular sidebar/module (10 items)                        |
| `CuratedCollection.astro` | Editorially curated content block                             |

### Interactive Islands (`.tsx` — Preact, JS shipped only when hydrated)

| Component                   | Directive        | Description                                          |
| --------------------------- | ---------------- | ---------------------------------------------------- |
| `BreakingTicker.tsx`        | `client:idle`    | Polls `ArchipelagoBreakingTickerQuery` every 30s     |
| `LoadMoreButton.tsx`        | `client:idle`    | Triggers offset-based pagination; prewarmed for INP  |
| `LiveBlogUpdater.tsx`       | `client:idle`    | Polls for new live blog entries                      |
| `VerticalVideoCarousel.tsx` | `client:visible` | Swipeable vertical video shorts carousel             |
| `VideoPlayer.tsx`           | `client:visible` | Brightcove / YouTube embed                           |
| `LivestreamPlayer.tsx`      | `client:visible` | Livestream video with config from `livestream` field |
| `NavigationMenu.tsx`        | `client:idle`    | Hamburger menu toggle for mobile                     |

---

## Routing

| Pattern                                      | Page File                                 | Page Type     |
| -------------------------------------------- | ----------------------------------------- | ------------- |
| `/`                                          | `src/pages/index.astro`                   | Homepage      |
| `/news/{year}/{month}/{day}/{slug}`          | `src/pages/news/[...slug].astro`          | Article       |
| `/news/liveblog/{year}/{month}/{day}/{slug}` | `src/pages/news/liveblog/[...slug].astro` | Live Blog     |
| `/{section}`                                 | `src/pages/[section].astro`               | Section Front |

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

The PoC aims to **exceed** the "Good" thresholds, not just clear them. Per-page acceptance criteria use the stretch column. A measured value worse than the floor fails the milestone outright.

| Metric  | "Good" floor | **Stretch (target)** | Measured On                                                                                |
| ------- | ------------ | -------------------- | ------------------------------------------------------------------------------------------ |
| **LCP** | < 2.5s       | **≤ 1.5s**           | All page types, 4G throttled                                                               |
| **CLS** | < 0.1        | **≤ 0.05**           | All page types                                                                             |
| **INP** | < 200ms      | **≤ 100ms**          | Interactive components (measured via puppeteer-core-driven interactions in the M2 harness) |

> Same stretch targets apply to the Qwik PoC — see top-level [README.md](../../../README.md#performance-targets--stretch-goals).

> **INP measurement divergence — read before tuning interactive components.** Two distinct INP code paths exist (acceptance-suite click→DOM-mutation proxy vs future real `onINP` capture). The full callout lives in [docs/PERF_INSTRUMENTATION.md § INP measurement divergence](../../../docs/PERF_INSTRUMENTATION.md#inp-measurement-divergence) — applies identically to both apps.

### JavaScript Budgets (Compressed)

| Page              | JS Target | Notes                                           |
| ----------------- | --------- | ----------------------------------------------- |
| **Homepage**      | < 50 KB   | Preact runtime + ticker + carousel islands      |
| **Article**       | < 30 KB   | Minimal interactivity — video player if present |
| **Live Blog**     | < 60 KB   | Polling + dynamic updates + Preact runtime      |
| **Section Front** | < 45 KB   | Load More button + ticker                       |

### SSR Performance & Lighthouse Scores

> **SSR throughput targets and Lighthouse category scores** (Performance / Accessibility / Best Practices / SEO) are framework-agnostic. Full table — including the per-target Performance split (Astro ≥ 98, Qwik ≥ 85 floor) — at [docs/PERFORMANCE_TARGETS.md](../../../docs/PERFORMANCE_TARGETS.md). Applies identically to both apps.

---

## Styling

**Tailwind CSS 4** with shared design tokens:

- Colors, typography, spacing as CSS custom properties
- Responsive breakpoints: mobile-first, tablet 768px, desktop 1024px, wide 1280px
- Dark mode: not in PoC scope

### Fonts

Use the **Astro 6 Fonts API** (`astro:assets/fonts`) for all web fonts — self-hosted, with automatic fallback metric generation to minimize CLS during font swap. Configured in `astro.config.mjs` via the `fonts` option (Google, Fontsource, or local providers).

This matters for the CLS budget (< 0.1) — manual `<link rel="preload">` + `font-display: swap` chains are the classic source of CLS regressions in news layouts; the built-in API generates size-adjusted fallbacks so the layout doesn't shift when the web font lands.

---

## Security

### Content Security Policy

Enable Astro 6's built-in **CSP** (stable in v6) via the `experimental.csp` → now-stable `csp` config option in `astro.config.mjs`. Astro automatically:

- Hashes every inline `<script>` and `<style>` it emits
- Generates the corresponding `Content-Security-Policy` header / `<meta>` tag
- Works for both static and SSR pages

For a news site that embeds third-party content (Twitter/X, YouTube, Instagram), the CSP needs an allowlist for those origins — declare them in the CSP config rather than disabling CSP for embeds.

```js
// astro.config.mjs — illustrative
export default defineConfig({
  csp: {
    directives: [
      'frame-src https://www.youtube.com https://platform.twitter.com https://www.instagram.com',
      "img-src 'self' https: data:",
      "connect-src 'self' http://localhost:4455",
    ],
  },
});
```

### Production runtime permissions

The Deno-targeted SSR build (see [Runtime & Tooling](#runtime--tooling)) starts with explicit `--allow-net=` and `--allow-read=./dist` flags. Document the exact flag set in the deployment script — never use `-A` (allow-all) in production.

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

Run via the shared **`packages/perf-harness/`** (built in M2). The harness:

- Drives interactions via puppeteer-core (so INP is captured)
- Runs Lighthouse against the resulting state
- Aggregates n ≥ 5 runs per page (CWV are noisy)
- Outputs a structured report consumable by the comparison report (M10)
- Same harness runs against the Qwik PoC for apples-to-apples data

Web Vitals are instrumented in this app via the `web-vitals` JS library (mirrored in the Qwik app for definition consistency). Bundle size analysis vs the per-page budgets above is part of M9.
