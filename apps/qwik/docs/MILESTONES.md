# Milestones — Qwik 2 (beta)

> 10 milestones from scaffolding to final comparison report.
>
> Cross-references:
> - [ARCHITECTURE.md](./ARCHITECTURE.md) — Qwik-specific technical design
> - [../../../docs/RESEARCH.md](../../../docs/RESEARCH.md) — verified production query patterns (shared with Astro PoC)
> - [../../../packages/perf-harness/](../../../packages/perf-harness/) — shared performance harness (built in M2)

### Performance targets — stretch goals

Both PoCs aim to **exceed** Core Web Vitals "Good" thresholds, not just clear them. Every per-page acceptance criterion uses the stretch column. A value worse than the floor fails the milestone outright.

| Metric | "Good" floor | **Stretch (target)** |
|--------|--------------|----------------------|
| LCP | < 2.5s | **≤ 1.5s** |
| CLS | < 0.1 | **≤ 0.05** |
| INP | < 200ms | **≤ 100ms** |
| Lighthouse Performance | ≥ 95 | **≥ 98** |

### Qwik 2 platform features in scope

| Feature | Where it shows up |
|---------|-------------------|
| **`@qwik.dev/core` / `@qwik.dev/router`** (renamed from `@builder.io/qwik` + `qwik-city`) | All imports, throughout |
| **`useSerializer$`** — opt-in client serialization (loaders no longer serialize by default) | Wherever `routeLoader$` data needs client access |
| **`allowStale` on `routeLoader$` / `AsyncSignal`** | Breaking ticker, live blog polling — alternative to manual `setInterval` |
| **`passive:` event markers** | Vertical video carousel scroll/touch |
| **HTML validation at build time** | `ArticleBody.tsx` rich-text rendering (catches invalid nesting) |
| **Leaner HTML output** (no comment nodes) | Smaller payload across all page types — helps LCP |

> **Beta status:** Qwik 2 is at `2.0.0-beta.32` as of April 2026. Stable release date unannounced. Plugin compatibility may have gaps; document any blocker as it appears.

---

## Milestone 1 — Project Scaffolding & Mock API

**Goal:** Qwik project scaffolded, mock API serving fixture data, basic data fetching working.

### Deliverables

- [ ] Deno mock API server (`packages/mock-api/`) with fixture loading — see [ARCHITECTURE.md → Mock GraphQL API](./ARCHITECTURE.md#mock-graphql-api)
- [ ] Recorded fixtures for all queries listed in [../../../docs/RESEARCH.md → Verified Queries by Page](../../../docs/RESEARCH.md#verified-queries-by-page)
- [ ] Qwik 2 project initialized in `apps/qwik/` using `@qwik.dev/core` 2.0.0-beta.x + `@qwik.dev/router` + Tailwind CSS 4 (deps managed by **bun**)
- [ ] GraphQL client utility (`src/lib/graphql.ts`) — see [ARCHITECTURE.md → GraphQL Client](./ARCHITECTURE.md#graphql-client)
- [ ] Placeholder `src/routes/index.tsx` with `routeLoader$` that fetches and logs `HomePageQuery` data

### Acceptance Criteria

- `bun run mock-api` (or `deno task mock-api`) starts and responds to `GET /graphql?operationName=HomePageQuery` with fixture JSON
- `wp-site` header is required (returns 400 without it)
- `bun install && bun run dev:qwik` starts the Qwik dev server without errors
- `bun run build:qwik` produces a working SSR bundle
- Console logs homepage data fetched from mock API via `routeLoader$`
- Document any beta-related blockers encountered (plugin incompatibility, missing types, etc.) in `apps/qwik/docs/QWIK2_NOTES.md`

---

## Milestone 2 — Performance Test Harness

**Goal:** A working, app-agnostic measurement rig (`packages/perf-harness/`) so every page added in M4–M8 is measured the moment it lands. Catches budget regressions early when they're cheap to fix, instead of at M9 when they trigger rework.

### Deliverables

- [ ] **Playwright runner** in `packages/perf-harness/` that drives interaction flows (Load More click, hamburger toggle, ticker dismiss) — required for INP measurement, since plain Lighthouse doesn't interact with the page
- [ ] **Lighthouse integration** that runs against the resulting interactive state, not a cold load
- [ ] **Multi-run aggregation** (n ≥ 5 per page) — CWV are noisy; report median + p95 per metric per page
- [ ] **`web-vitals` JS library** instrumented in the Qwik app (and mirrored in the Astro app) for a single source of truth on metric definitions
- [ ] **Comparison reporter** — emits structured JSON / Markdown that M10 can consume directly
- [ ] **`chrome-devtools-mcp` playbook** documented in `packages/perf-harness/README.md` for on-demand probes during development (not part of CI)
- [ ] CLI entrypoint: `bun run perf:qwik` runs against the built Qwik app; mirrors for Astro

> Note: M2 work is the **same shared package** for both PoCs. If the Astro PoC builds it first, the Qwik PoC just instruments `web-vitals` and confirms the runner targets the Qwik dev/preview server correctly.

### Acceptance Criteria

- Running `bun run perf:qwik` against the M1 placeholder page returns a structured report with median LCP, CLS, INP, JS bundle size, Lighthouse score
- Same harness, identical config, runs cleanly against the Astro app stub (proving framework-agnosticism)
- Report output is diffable across runs (deterministic format, no timestamps in body)
- Documented "how to interpret" in `packages/perf-harness/README.md` — what counts as "passing stretch"

---

## Milestone 3 — Layout & Navigation

**Goal:** Global page shell with hardcoded navigation, responsive layout, and footer.

### Deliverables

- [ ] `src/routes/layout.tsx` — root layout with nav, footer, ticker slot
- [ ] Hardcoded navigation — see [../../../docs/RESEARCH.md → Navigation](../../../docs/RESEARCH.md#navigation)
- [ ] `Navigation.tsx` — hamburger menu toggle using `$()` lazy click handler
- [ ] `Footer.tsx` with link columns
- [ ] Tailwind design tokens (colors, typography, spacing)
- [ ] Web font loading: `<link rel="preload">` + `font-display: swap` + `size-adjust` for CLS protection (Qwik 2 has no built-in Fonts API equivalent to Astro's)

### Acceptance Criteria

- Navigation renders correctly at mobile, tablet, and desktop breakpoints
- Hamburger menu toggles on mobile — handler JS loads only on click (lazy `$()`)
- Layout matches production visual structure
- Footer renders with appropriate link columns
- Web fonts render with no observable layout shift on first load
- **M2 harness reports CLS ≤ 0.05** for the bare layout page (formal stretch target met)

---

## Milestone 4 — Homepage

**Goal:** Full homepage rendering with all content modules.

### Deliverables

- [ ] `src/routes/index.tsx` with `routeLoader$` fetching `HomePageQuery` + `HomePageCuratedFeedQuery`
- [ ] Three-column layout driven by `layout: "three-column"` from fixture
- [ ] `HeroCard.tsx` for `featuredPosts[0]`
- [ ] `StoryCard.tsx` grid for remaining featured posts (up to 17)
- [ ] `MostPopular.tsx` module (10 items)
- [ ] `VerticalVideoCarousel.tsx` — interactive with `$()` handlers for swipe/scroll (use `passive:` event marker)
- [ ] `LivestreamPlayer.tsx` — interactive with `$()` handlers, configured from `livestream` field
- [ ] `CuratedCollection.tsx` block
- [ ] `layoutMetaData` drives top stories count and theme
- [ ] See [../../../docs/RESEARCH.md → Homepage](../../../docs/RESEARCH.md#homepage) for query details

### Acceptance Criteria

- All content modules render with fixture data
- Layout is responsive (mobile stacks to single column)
- `VerticalVideoCarousel` is interactive (swipe/scroll)
- Interactive handlers are lazy-loaded — zero JS until interaction
- **M2 harness reports stretch CWV met:** LCP ≤ 1.5s, CLS ≤ 0.05, INP ≤ 100ms, Lighthouse Performance ≥ 98
- Homepage JS budget: < 15 KB compressed

---

## Milestone 5 — Article Page

**Goal:** Full article page with rich content rendering.

### Deliverables

- [ ] `src/routes/news/[...slug]/index.tsx` — dynamic route
- [ ] `routeLoader$` fetching `ArchipelagoSingleArticleQuery` (ID 68) + `HomePageCuratedFeedQuery`
- [ ] `ArticleBody.tsx` — renders rich text with:
  - Images with captions
  - Pull quotes / blockquotes
  - Embedded tweets, YouTube videos, Instagram posts
  - Inline galleries
- [ ] Article metadata (author, date, categories, share links)
- [ ] Related stories section from curated feed
- [ ] Verify Qwik 2's HTML validation doesn't flag the rendered embed markup; fix any invalid-nesting warnings
- [ ] See [../../../docs/RESEARCH.md → Article Page](../../../docs/RESEARCH.md#article-page)

### Acceptance Criteria

- Article renders correctly from fixture data
- All embed types display (at minimum: images, YouTube, tweets)
- Related stories section renders
- No HTML validation warnings from Qwik 2 build
- **M2 harness reports stretch CWV met** on the article route
- Article JS budget: < 10 KB compressed

---

## Milestone 6 — Section Front (Both Architectures)

**Goal:** Section front pages with geographic and topic variants, plus "Load More" pagination.

### Deliverables

- [ ] `src/routes/[section]/index.tsx` — single route handling both architectures
- [ ] Section type resolution — geographic vs topic — see [ARCHITECTURE.md → Section Type Resolution](./ARCHITECTURE.md#section-type-resolution)
- [ ] Geographic section (`/middle-east`):
  - `routeLoader$` with `ArchipelagoSectionQuery` (ID 64) + `categoryType: "where"`
  - Pagination via `ArchipelagoAjeSectionPostsQuery` (ID 7) with offset
- [ ] Topic section (`/opinion`):
  - `routeLoader$` with `ArchipelagoTopicsPageQuery` (ID 92) + `slug`
  - Pagination via `ArchipelagoPaginatedTopicsFeedQuery` with offset
- [ ] `LoadMoreButton.tsx` — uses `$()` lazy click handler for client-side GraphQL calls, appends results via `useSignal`
- [ ] See [../../../docs/RESEARCH.md → Section Front](../../../docs/RESEARCH.md#section-front--geographic-eg-middle-east)

### Acceptance Criteria

- Both `/middle-east` and `/opinion` render correctly with fixture data
- "Load More" fetches next page and appends cards without full page reload
- Offset increments correctly (0 → 9 → 18 → ...)
- `LoadMoreButton` uses `$()` lazy handler — JS loaded only on first click
- Section type correctly auto-detected from URL
- **M2 harness reports stretch CWV met**, including INP ≤ 100ms after Load More click (this is the key INP test for the page)
- Section Front JS budget: < 15 KB compressed

---

## Milestone 7 — Live Blog

**Goal:** Live blog page with three-query architecture and polling for updates.

### Deliverables

- [ ] `src/routes/news/liveblog/[...slug]/index.tsx` — dynamic route
- [ ] `routeLoader$` with three-query data fetching:
  1. `ArchipelagoSingleLiveBlogQuery` — blog shell
  2. `SingleLiveBlogChildrensQuery` — children list
  3. `LiveBlogUpdateQuery` × N — individual update content
  - See [../../../docs/RESEARCH.md → Live Blog](../../../docs/RESEARCH.md#live-blog)
- [ ] `LiveBlogUpdater.tsx` — polling for new entries (30s). Evaluate Qwik 2's `allowStale` option on `AsyncSignal` as an alternative to manual `setInterval` in `useVisibleTask$()`; document which approach was chosen and why
- [ ] Live blog entry rendering (text, images, embeds)
- [ ] Timestamp display and "X minutes ago" relative time

### Acceptance Criteria

- Live blog shell + entries render from fixtures
- Polling mechanism works (mock API can return varying fixture data)
- New entries prepend to the list
- **M2 harness reports stretch CWV met**, including no CLS regression when new entries prepend
- Live Blog JS budget: < 20 KB compressed

---

## Milestone 8 — Breaking News Ticker

**Goal:** Global breaking news ticker that polls on every page.

### Deliverables

- [ ] `BreakingTicker.tsx` — uses `useVisibleTask$()` (or `allowStale` route loader pattern from M7) for polling
- [ ] Polls `ArchipelagoBreakingTickerQuery` (ID 18) every 30 seconds
- [ ] Renders as a dismissable banner when breaking content exists
- [ ] Integrated into root `layout.tsx` on all pages

### Acceptance Criteria

- Ticker appears when fixture returns breaking content
- Ticker dismisses on user action (dismiss handler via `$()`)
- Polling interval is 30s
- Ticker renders on all four page types
- Polling starts on mount — no upfront JS cost for the ticker UI before visible
- **M2 harness re-runs across all four page types confirm stretch CWV still met** with the ticker added (regression check — this is the global addition that could break previous milestones' numbers)

---

## Milestone 9 — Final Performance Validation

**Goal:** Multi-run aggregated validation across all four page types, plus an audit of any beta-quality issues that might affect production-credible comparison data.

### Deliverables

- [ ] Run M2 harness with **n ≥ 10** per page (full statistical confidence) and record median + p95 per metric
- [ ] **JS bundle analysis** — actual sizes vs budgets, broken down by route
- [ ] **SSR throughput benchmark** (requests/second per page type)
- [ ] **Image optimization audit** (lazy loading, proper sizing, WebP/AVIF) — verify no images blow the LCP budget
- [ ] **Beta-status audit** — review `apps/qwik/docs/QWIK2_NOTES.md` accumulated through M1–M8; note any feature gaps, plugin incompatibilities, or workarounds that affected the implementation. This becomes input to M10's tradeoffs section.
- [ ] **HTML validation pass** — confirm Qwik 2's build-time validator emits zero warnings across all four page types

### Acceptance Criteria

| Metric | Floor (must pass) | **Stretch (target)** | All four page types |
|--------|-------------------|----------------------|---------------------|
| LCP | < 2.5s | **≤ 1.5s** | ✓ |
| CLS | < 0.1 | **≤ 0.05** | ✓ |
| INP | < 200ms | **≤ 100ms** | ✓ |
| Lighthouse Perf | ≥ 95 | **≥ 98** | ✓ |
| Homepage JS | — | < 15 KB | n/a |
| Article JS | — | < 10 KB | n/a |
| Live Blog JS | — | < 20 KB | n/a |
| Section Front JS | — | < 15 KB | n/a |

- All Playwright interaction tests pass
- SSR throughput > 50 req/s per page type
- All metrics on stretch column (not floor) for the milestone to be "complete"; floor-but-not-stretch values are recorded as a known limitation in M10

---

## Milestone 10 — Comparison Report

**Goal:** Side-by-side comparison document with data-backed findings, written into `docs/COMPARISON.md` at the repo root (not in this app's tree — it spans both apps).

### Deliverables

- [ ] **Performance data** — CWV, JS size, SSR throughput for all page types, both apps, from the shared M2 harness
- [ ] **DX assessment** — build times, dev server HMR speed, code complexity, TypeScript experience
- [ ] **Architecture notes** — resumability model strengths and limitations observed
- [ ] **Qwik 2 beta experience** — practical experience with the new APIs (`@qwik.dev/core` migration, `useSerializer$`, `allowStale`, HTML validation, leaner HTML); what worked, what was rough, beta-specific gotchas
- [ ] **Ecosystem assessment** — documentation quality (especially for Qwik 2 vs 1), community size, edge deployment support
- [ ] **Production readiness** — SEO, a11y, i18n potential, team learning curve, beta risk assessment for production rebuild
- [ ] **Tradeoffs** — where Qwik excels and where it struggles relative to Astro

### Acceptance Criteria

- Report includes measured data (not opinions) for all performance metrics
- Implementation is functionally complete (same pages, same data as Astro PoC)
- Tradeoffs are clearly stated with evidence
- Beta-status risks explicitly addressed for production-readiness recommendation

---

## Timeline Overview

| Milestone | Estimated Effort | Dependencies |
|-----------|-----------------|--------------|
| 1. Scaffolding & Mock API | 2–3 days (add 1 day for beta debugging) | None |
| 2. Performance Test Harness | 2–3 days | M1 (shared with Astro PoC) |
| 3. Layout & Navigation | 2 days | M1 (M2 strongly recommended for measurement) |
| 4. Homepage | 3–4 days | M3 |
| 5. Article Page | 2–3 days | M3 |
| 6. Section Front | 3–4 days | M3 |
| 7. Live Blog | 3–4 days | M3 |
| 8. Breaking Ticker | 1 day | M3 |
| 9. Final Performance Validation | 2–3 days | M4–M8 |
| 10. Comparison Report | 2–3 days | M9 + Astro M9 |

**Total estimated effort:** ~5 weeks (with beta-friction buffer).

Milestones 4–8 can proceed in any order after M3 is complete. M2 ideally lands before M4 so each page can be measured against stretch targets the moment it ships.
