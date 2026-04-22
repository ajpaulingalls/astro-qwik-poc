# Milestones — Astro 6 + Preact

> 10 milestones from scaffolding to final comparison report.
>
> Cross-references:
>
> - [ARCHITECTURE.md](./ARCHITECTURE.md) — Astro-specific technical design
> - [../../../docs/RESEARCH.md](../../../docs/RESEARCH.md) — verified production query patterns (shared with Qwik PoC)
> - [../../../packages/perf-harness/](../../../packages/perf-harness/) — shared performance harness (built in M2)

### Performance targets — stretch goals

Both PoCs aim to **exceed** Core Web Vitals "Good" thresholds, not just clear them. Every per-page acceptance criterion uses the stretch column. A value worse than the floor fails the milestone outright.

| Metric                 | "Good" floor | **Stretch (target)** |
| ---------------------- | ------------ | -------------------- |
| LCP                    | < 2.5s       | **≤ 1.5s**           |
| CLS                    | < 0.1        | **≤ 0.05**           |
| INP                    | < 200ms      | **≤ 100ms**          |
| Lighthouse Performance | ≥ 95         | **≥ 98**             |

### Astro 6 platform features in scope

| Feature                                                                                       | First introduced                         | Validated  |
| --------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------- |
| **`@deno/astro-adapter`** — production SSR runs on Deno 2 with explicit permission flags      | M1                                       | M9         |
| **Fonts API** (`astro:assets/fonts`) — self-hosted fonts with size-adjusted fallbacks for CLS | M1                                       | M3 + M9    |
| **CSP** (stable in v6) — automatic script/style hashing and header generation                 | M1 (baseline) → M5/M7 (embed allowlists) | M9 (audit) |

**Considered and rejected:** server islands. See [ARCHITECTURE.md → Why client islands and not server islands](./ARCHITECTURE.md#why-client-islands-and-not-server-islands).

---

## Milestone 1 — Project Scaffolding & Mock API

**Goal:** Astro project scaffolded, mock API serving fixture data, basic data fetching working.

### Deliverables

- [ ] Deno mock API server (`packages/mock-api/`) with fixture loading — see [ARCHITECTURE.md → Mock GraphQL API](./ARCHITECTURE.md#mock-graphql-api)
- [ ] Recorded fixtures for all queries listed in [../../../docs/RESEARCH.md → Verified Queries by Page](../../../docs/RESEARCH.md#verified-queries-by-page)
- [ ] Astro 6 project initialized in `apps/astro/` with Preact integration + Tailwind CSS 4 (deps managed by **bun**)
- [ ] `@deno/astro-adapter` configured in `astro.config.mjs` so the production build targets Deno — see [ARCHITECTURE.md → Runtime & Tooling](./ARCHITECTURE.md#runtime--tooling)
- [ ] **Astro Fonts API** configured in `astro.config.mjs` with self-hosted fonts and size-adjusted fallbacks — see [ARCHITECTURE.md → Fonts](./ARCHITECTURE.md#fonts)
- [ ] **Baseline CSP** declared in `astro.config.mjs` (no embed allowlists yet — those land in M5/M7) — see [ARCHITECTURE.md → Security](./ARCHITECTURE.md#security)
- [ ] GraphQL client utility (`src/lib/graphql.ts`) — see [ARCHITECTURE.md → GraphQL Client](./ARCHITECTURE.md#graphql-client)
- [ ] Placeholder `index.astro` that fetches and logs `HomePageQuery` data

### Acceptance Criteria

- `bun run mock-api` (or `deno task mock-api`) starts and responds to `GET /graphql?operationName=HomePageQuery` with fixture JSON
- `wp-site` header is required (returns 400 without it)
- `bun install && bun run dev:astro` starts the Astro dev server without errors
- `bun run build:astro` produces a Deno-targeted SSR bundle (via `@deno/astro-adapter`)
- Built bundle starts under Deno with explicit `--allow-net=...` and `--allow-read=./dist` flags (no `-A`) and serves the placeholder page
- Browser DevTools shows a `Content-Security-Policy` header on the placeholder response with no console violations
- Console logs homepage data fetched from mock API

---

## Milestone 2 — Performance Test Harness

**Goal:** A working, app-agnostic measurement rig (`packages/perf-harness/`) so every page added in M4–M8 is measured the moment it lands. Catches budget regressions early when they're cheap to fix, instead of at M9 when they trigger rework.

### Deliverables

- [ ] **puppeteer-core runner** in `packages/perf-harness/` that drives interaction flows (Load More click, hamburger toggle, ticker dismiss) — required for INP measurement, since plain Lighthouse doesn't interact with the page
- [ ] **Lighthouse integration** that runs against the resulting interactive state, not a cold load
- [ ] **Multi-run aggregation** (n ≥ 5 per page) — CWV are noisy; report median + p95 per metric per page
- [ ] **`web-vitals` JS library** instrumented in the Astro app (and mirrored in the Qwik app) for a single source of truth on metric definitions
- [ ] **Comparison reporter** — emits structured JSON / Markdown that M10 can consume directly
- [ ] **`chrome-devtools-mcp` playbook** documented in `packages/perf-harness/README.md` for on-demand probes during development (not part of CI)
- [ ] CLI entrypoint: `bun run perf:astro` runs against the built Astro app; mirrors for Qwik

### Acceptance Criteria

- Running `bun run perf:astro` against the M1 placeholder page returns a structured report with median LCP, CLS, INP, JS bundle size, Lighthouse score
- Same harness, identical config, runs cleanly against an empty Qwik app stub (proving framework-agnosticism before Qwik M1 lands)
- Report output is diffable across runs (deterministic format, no timestamps in body)
- Documented "how to interpret" in `packages/perf-harness/README.md` — what counts as "passing stretch"

---

## Milestone 3 — Layout & Navigation

**Goal:** Global page shell with hardcoded navigation, responsive layout, and footer.

### Deliverables

- [ ] `BaseLayout.astro` — global wrapper with nav, footer, ticker slot
- [ ] Hardcoded navigation — see [../../../docs/RESEARCH.md → Navigation](../../../docs/RESEARCH.md#navigation)
- [ ] `NavigationMenu.tsx` — Preact island for hamburger menu toggle (`client:idle`)
- [ ] `Footer.astro` with link columns
- [ ] Tailwind design tokens (colors, typography, spacing) — typography wired to fonts loaded via the **Astro Fonts API** configured in M1

### Acceptance Criteria

- Navigation renders correctly at mobile, tablet, and desktop breakpoints
- Hamburger menu toggles on mobile — JS loads via `client:idle`
- Layout matches production visual structure
- Footer renders with appropriate link columns
- Web fonts render with no observable layout shift on first load (size-adjusted fallback in effect)
- **M2 harness reports CLS ≤ 0.05** for the bare layout page (formal stretch target met)

---

## Milestone 4 — Homepage

**Goal:** Full homepage rendering with all content modules.

### Deliverables

- [ ] `index.astro` with `HomePageQuery` + `HomePageCuratedFeedQuery` data fetching in frontmatter
- [ ] Three-column layout driven by `layout: "three-column"` from fixture
- [ ] `HeroCard.astro` for `featuredPosts[0]`
- [ ] `StoryCard.astro` grid for remaining featured posts (up to 17)
- [ ] `MostPopular.astro` module (10 items)
- [ ] `VerticalVideoCarousel.tsx` — Preact island (`client:visible`) for 10 vertical videos
- [ ] `LivestreamPlayer.tsx` — Preact island (`client:visible`) configured from `livestream` field
- [ ] `CuratedCollection.astro` block
- [ ] `layoutMetaData` drives top stories count and theme
- [ ] See [../../../docs/RESEARCH.md → Homepage](../../../docs/RESEARCH.md#homepage) for query details

### Acceptance Criteria

- All content modules render with fixture data
- Layout is responsive (mobile stacks to single column)
- `VerticalVideoCarousel` is interactive (swipe/scroll)
- Interactive components are Preact islands with `client:visible`
- **M2 harness reports stretch CWV met:** LCP ≤ 1.5s, CLS ≤ 0.05, INP ≤ 100ms, Lighthouse Performance ≥ 98
- Homepage JS budget: < 50 KB compressed

---

## Milestone 5 — Article Page

**Goal:** Full article page with rich content rendering.

### Deliverables

- [ ] `src/pages/news/[...slug].astro` — dynamic route
- [ ] Data fetching: `ArchipelagoSingleArticleQuery` (ID 68) + `HomePageCuratedFeedQuery` in frontmatter
- [ ] `ArticleBody.astro` — renders rich text with:
  - Images with captions
  - Pull quotes / blockquotes
  - Embedded tweets, YouTube videos, Instagram posts
  - Inline galleries
- [ ] Article metadata (author, date, categories, share links)
- [ ] Related stories section from curated feed
- [ ] **CSP embed allowlists** added to `astro.config.mjs` for each embed type introduced (e.g. `frame-src https://www.youtube.com https://platform.twitter.com https://www.instagram.com`, plus matching `img-src` / `script-src` entries) — see [ARCHITECTURE.md → Content Security Policy](./ARCHITECTURE.md#content-security-policy)
- [ ] See [../../../docs/RESEARCH.md → Article Page](../../../docs/RESEARCH.md#article-page)

### Acceptance Criteria

- Article renders correctly from fixture data
- All embed types display (at minimum: images, YouTube, tweets)
- Related stories section renders
- **No CSP violations** in browser console for any embed type
- **M2 harness reports stretch CWV met** on the article route
- Article JS budget: < 30 KB compressed

---

## Milestone 6 — Section Front (Both Architectures)

**Goal:** Section front pages with geographic and topic variants, plus "Load More" pagination.

### Deliverables

- [ ] `src/pages/[section].astro` — single page handling both architectures
- [ ] Section type resolution — geographic vs topic — see [ARCHITECTURE.md → Section Type Resolution](./ARCHITECTURE.md#section-type-resolution)
- [ ] Geographic section (`/middle-east`):
  - Initial load via `ArchipelagoSectionQuery` (ID 64) with `categoryType: "where"` in frontmatter
  - Pagination via `ArchipelagoAjeSectionPostsQuery` (ID 7) with offset
- [ ] Topic section (`/opinion`):
  - Initial load via `ArchipelagoTopicsPageQuery` (ID 92) with `slug` in frontmatter
  - Pagination via `ArchipelagoPaginatedTopicsFeedQuery` with offset
- [ ] `LoadMoreButton.tsx` — Preact island (`client:visible`) making client-side GraphQL calls, appending results
- [ ] See [../../../docs/RESEARCH.md → Section Front](../../../docs/RESEARCH.md#section-front--geographic-eg-middle-east)

### Acceptance Criteria

- Both `/middle-east` and `/opinion` render correctly with fixture data
- "Load More" fetches next page and appends cards without full page reload
- Offset increments correctly (0 → 9 → 18 → ...)
- `LoadMoreButton` is a Preact island with `client:visible`
- Section type correctly auto-detected from URL
- **M2 harness reports stretch CWV met**, including INP ≤ 100ms after Load More click (this is the key INP test for the page)
- Section Front JS budget: < 45 KB compressed

---

## Milestone 7 — Live Blog

**Goal:** Live blog page with three-query architecture and polling for updates.

### Deliverables

- [ ] `src/pages/news/liveblog/[...slug].astro` — dynamic route
- [ ] Three-query data fetching in frontmatter:
  1. `ArchipelagoSingleLiveBlogQuery` — blog shell
  2. `SingleLiveBlogChildrensQuery` — children list
  3. `LiveBlogUpdateQuery` × N — individual update content
  - See [../../../docs/RESEARCH.md → Live Blog](../../../docs/RESEARCH.md#live-blog)
- [ ] `LiveBlogUpdater.tsx` — Preact island (`client:idle`) polling for new entries (30s interval)
- [ ] Live blog entry rendering (text, images, embeds)
- [ ] Timestamp display and "X minutes ago" relative time
- [ ] Extend CSP allowlists if any embed type appears that wasn't covered in M5 (X/Twitter cards in entries, etc.)

### Acceptance Criteria

- Live blog shell + entries render from fixtures
- Polling mechanism works (mock API can return varying fixture data)
- New entries prepend to the list
- `LiveBlogUpdater` is a Preact island with `client:idle`
- No CSP violations for entry embeds
- **M2 harness reports stretch CWV met**, including no CLS regression when new entries prepend
- Live Blog JS budget: < 60 KB compressed

---

## Milestone 8 — Breaking News Ticker

**Goal:** Global breaking news ticker that polls on every page.

### Deliverables

- [ ] `BreakingTicker.tsx` — Preact island (`client:idle`)
- [ ] Polls `ArchipelagoBreakingTickerQuery` (ID 18) every 30 seconds
- [ ] Renders as a dismissable banner when breaking content exists
- [ ] Integrated into `BaseLayout.astro` on all pages

### Acceptance Criteria

- Ticker appears when fixture returns breaking content
- Ticker dismisses on user action
- Polling interval is 30s
- Ticker renders on all four page types
- Preact island hydrates via `client:idle`
- **M2 harness re-runs across all four page types confirm stretch CWV still met** with the ticker added (regression check — this is the global addition that could break previous milestones' numbers)

---

## Milestone 9 — Final Performance Validation

**Goal:** Multi-run aggregated validation across all four page types, plus the platform-feature audits required to call the implementation production-credible.

### Deliverables

- [ ] Run M2 harness with **n ≥ 10** per page (full statistical confidence) and record median + p95 per metric
- [ ] **JS bundle analysis** — actual sizes vs budgets, broken down by route
- [ ] **SSR throughput benchmark** (requests/second per page type) under the production Deno runtime
- [ ] **Image optimization audit** (lazy loading, proper sizing, WebP/AVIF) — verify no images blow the LCP budget
- [ ] **CSP audit** — load each of the four page types and confirm zero `Content-Security-Policy` violations in DevTools console; record the final directive set in `apps/astro/docs/SECURITY.md`
- [ ] **Fonts API CLS validation** — confirm Lighthouse CLS breakdown shows no shift attributable to font swap on any page type
- [ ] **Production permission audit** — document the final, narrowest viable `deno run --allow-...` flag set for serving `dist/`; verify the server starts and serves all page types under it

### Acceptance Criteria

| Metric           | Floor (must pass) | **Stretch (target)** | All four page types |
| ---------------- | ----------------- | -------------------- | ------------------- |
| LCP              | < 2.5s            | **≤ 1.5s**           | ✓                   |
| CLS              | < 0.1             | **≤ 0.05**           | ✓                   |
| INP              | < 200ms           | **≤ 100ms**          | ✓                   |
| Lighthouse Perf  | ≥ 95              | **≥ 98**             | ✓                   |
| Homepage JS      | —                 | < 50 KB              | n/a                 |
| Article JS       | —                 | < 30 KB              | n/a                 |
| Live Blog JS     | —                 | < 60 KB              | n/a                 |
| Section Front JS | —                 | < 45 KB              | n/a                 |

- All puppeteer-core interaction tests pass
- SSR throughput > 50 req/s per page type
- Zero CSP violations across all four page types
- All metrics on stretch column (not floor) for the milestone to be "complete"; floor-but-not-stretch values are recorded as a known limitation in M10

---

## Milestone 10 — Comparison Report

**Goal:** Side-by-side comparison document with data-backed findings, written into `docs/COMPARISON.md` at the repo root (not in this app's tree — it spans both apps).

### Deliverables

- [ ] **Performance data** — CWV, JS size, SSR throughput for all page types, both apps, from the shared M2 harness
- [ ] **DX assessment** — build times, dev server HMR speed, code complexity, TypeScript experience
- [ ] **Architecture notes** — island model strengths and limitations observed; whether server islands would have been a better fit for any component (revisit the early decision with hindsight)
- [ ] **Astro 6 platform features** — practical experience with Fonts API, stable CSP, `@deno/astro-adapter`, and Vite Environment API; what worked, what was rough
- [ ] **Ecosystem assessment** — documentation quality, plugin availability, edge deployment support
- [ ] **Production readiness** — SEO, a11y, i18n potential, team learning curve
- [ ] **Tradeoffs** — where Astro excels and where it struggles relative to Qwik

### Acceptance Criteria

- Report includes measured data (not opinions) for all performance metrics
- Implementation is functionally complete (same pages, same data as Qwik PoC)
- Tradeoffs are clearly stated with evidence

---

## Timeline Overview

| Milestone                       | Estimated Effort | Dependencies                                 |
| ------------------------------- | ---------------- | -------------------------------------------- |
| 1. Scaffolding & Mock API       | 2–3 days         | None                                         |
| 2. Performance Test Harness     | 2–3 days         | M1                                           |
| 3. Layout & Navigation          | 2 days           | M1 (M2 strongly recommended for measurement) |
| 4. Homepage                     | 3–4 days         | M3                                           |
| 5. Article Page                 | 2–3 days         | M3                                           |
| 6. Section Front                | 3–4 days         | M3                                           |
| 7. Live Blog                    | 3–4 days         | M3                                           |
| 8. Breaking Ticker              | 1 day            | M3                                           |
| 9. Final Performance Validation | 2–3 days         | M4–M8                                        |
| 10. Comparison Report           | 2–3 days         | M9 + Qwik M9                                 |

**Total estimated effort:** ~5 weeks.

Milestones 4–8 can proceed in any order after M3 is complete. M2 ideally lands before M4 so each page can be measured against stretch targets the moment it ships.
