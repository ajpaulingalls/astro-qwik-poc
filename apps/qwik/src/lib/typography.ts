/**
 * Shared display class for HeroCard h2 and ArticleHeader h1 — single source
 * of truth keeps the two surfaces visually aligned.
 *
 * `leading-[1.05]` is intentional and arbitrary: Tailwind's `leading-tight`
 * (1.25) reads loose at text-3xl/4xl. 1.05 matches the conventional
 * editorial display ratio.
 */
export const DISPLAY_HEADLINE_CLASS =
  'font-serif text-3xl md:text-4xl font-bold leading-[1.05] tracking-tight text-neutral-900';
