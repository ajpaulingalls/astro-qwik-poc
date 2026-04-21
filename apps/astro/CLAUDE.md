# CLAUDE.md — apps/astro

This file is scoped to the **Astro 6 PoC**. For monorepo-wide guidance (shared mock API, shared perf harness, production API constraints, doc lookup tricks), see [../../CLAUDE.md](../../CLAUDE.md).

## App state

Spec-only. No `src/`, no `astro.config.mjs`, no `package.json` deps installed. Implementation begins at M1 (`docs/MILESTONES.md`). Don't grep for components yet.

## Astro-specific decisions

Codified in `docs/ARCHITECTURE.md` — don't relitigate without explicit user input:

- **Framework:** Astro **6** (latest stable; ignore stale "Astro 5" references in older commits)
- **Islands:** Preact via `@astrojs/preact`
- **Package manager + dev runtime:** **bun** (`bun install`, `bun run dev:astro` from repo root)
- **Production SSR runtime:** **Deno 2** via [`@deno/astro-adapter`](https://github.com/denoland/deno-astro-adapter) `^0.4.0` (peer-deps `astro: ^6.0.0`)
- **Styling:** Tailwind CSS 4
- **Server islands:** explicitly considered and rejected — see `docs/ARCHITECTURE.md → Why client islands and not server islands`

The runtime split rationale (why bun for dev even though Astro 6 supports Deno-in-dev via the Vite Environment API) is in `docs/ARCHITECTURE.md → Runtime & Tooling`.

## Astro 6 platform features in use

| Feature | Configured in | Validated in |
|---------|--------------|--------------|
| `@deno/astro-adapter` | M1 (`astro.config.mjs`) | M9 |
| Fonts API (`astro:assets/fonts`) | M1 (`astro.config.mjs`) | M3 + M9 |
| CSP (stable in v6) | M1 baseline → M5/M7 embed allowlists | M9 audit |

## Looking up Astro 6 specifics

`docs.astro.build` does **not** host `llms.txt` or per-page `.md` versions (verified 2026-04 — all 404). For authoritative source markdown:

```bash
gh api repos/withastro/docs/contents/src/content/docs/en/<path>.mdx --jq '.content' | base64 -d
```

In particular, the CSP config example in `docs/ARCHITECTURE.md` was written from release-notes summaries and should be cross-checked against the live config reference before scaffolding `astro.config.mjs`.
