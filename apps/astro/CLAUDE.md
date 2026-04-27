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

The `build` script is `bun --bun astro build` (not bare `astro build`). Astro 6's CLI hard-checks `process.version >= 22.12`; the `--bun` flag forces the script to run under bun's runtime, which Astro accepts as a non-Node runtime and skips the version gate. Without the flag, builds fail under Node 20.x with `Node.js v20.x.x is not supported by Astro!`. Same trick is needed for any Astro CLI invocation.

## Astro 6 platform features in use

| Feature                          | Configured in                        | Validated in |
| -------------------------------- | ------------------------------------ | ------------ |
| `@deno/astro-adapter`            | M1 (`astro.config.mjs`)              | M9           |
| Fonts API (`astro:assets/fonts`) | M1 (`astro.config.mjs`)              | M3 + M9      |
| CSP (stable in v6)               | M1 baseline → M5/M7 embed allowlists | M9 audit     |

## Looking up Astro 6 specifics

Pick the source that matches the question (top-level `../../CLAUDE.md` has the full table):

### Type signatures / API shape — after `bun install`

Prefer reading installed `.d.ts` files (with JSDoc) over network calls:

```
node_modules/astro/dist/index.d.ts                   ← root types: defineConfig, AstroConfig, integrations API
node_modules/astro/dist/types/                       ← deeper types (CSP, fonts, env, etc.)
node_modules/@astrojs/preact/dist/index.d.ts         ← Preact integration options
node_modules/@deno/astro-adapter/src/index.ts        ← adapter exports `.ts` source directly
```

These reflect the **exact installed version** — release-notes summaries and blog posts can lag. The CSP config example in `docs/ARCHITECTURE.md` was sourced from release notes and should be cross-checked against `node_modules/astro/dist/types/` before scaffolding `astro.config.mjs`.

### Hover / goto-def — once an app file exists

Use the `LSP` tool (`hover`, `goToDefinition`) on any TypeScript symbol — faster than reading files for one-off checks.

### Conceptual / migration docs — `gh api`

Guides aren't shipped in the npm package. Fetch from the docs source repo:

```bash
gh api repos/withastro/docs/contents/src/content/docs/en/<path>.mdx --jq '.content' | base64 -d
```

Useful entry points:

- `guides/upgrade-to/v6.mdx` — v5→v6 migration
- `reference/configuration-reference.mdx` — config schema (use this to cross-check CSP shape)

### Preflight

`node_modules/` and LSP only work after M1 has scaffolded the app and `bun install` has run. Before then, only `gh api` is available.
