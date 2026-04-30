// Capstone article suite (story-008): one navigated DOM probe per fixture
// variant, asserting the article shell, the embed-specific DOM signature,
// and the related-stories module. Cross-app divergence here is the fairness
// signal — both apps must render the same set of structural elements from
// identical fixture data.

import { it, expect } from 'vitest';
import {
  type AcceptanceContext,
  DESKTOP,
  MIN_RELATED,
  MAX_RELATED,
  appHttpBase,
} from './shared.ts';

// Each variant requires the matching ArchipelagoSingleArticleQuery--<last
// segment of slug>.json fixture. The gallery/instagram fixtures' article.link
// fields claim a `-for-m7-fixture` suffix that does NOT exist in the actual
// filename — the mock-api resolves on filename, so use the filename here.
interface ArticleVariant {
  name: string;
  slug: string;
  signature: string;
}
const ARTICLE_VARIANTS: ArticleVariant[] = [
  {
    name: 'twitter',
    slug: 'features/2026/4/24/russian-oil-exports-slump-as-ukraine-hammers-ports-and-refineries',
    signature: 'blockquote.twitter-tweet',
  },
  {
    name: 'gallery',
    slug: '2026/4/25/sample-article-with-gallery-embed',
    signature: '.wp-block-gallery',
  },
  {
    name: 'instagram',
    slug: '2026/4/25/sample-article-with-instagram-embed',
    signature: 'blockquote.instagram-media',
  },
  {
    name: 'youtube',
    slug: '2026/4/27/sample-article-with-youtube-embed',
    signature: 'iframe[src*="youtube.com/embed"]',
  },
  {
    name: 'brightcove',
    slug: '2026/4/21/trump-announces-extending-iran-ceasefire-but-says-blockade-remains',
    signature: 'video-js',
  },
];

export function registerArticleVariantTests(ctx: AcceptanceContext): void {
  for (const variant of ARTICLE_VARIANTS) {
    it(`renders ${variant.name} embed + related-stories at /news/${variant.slug}`, async () => {
      const url = `${appHttpBase(ctx.target)}/news/${variant.slug}`;
      const result = await ctx.withPage(
        DESKTOP,
        (page) =>
          page.evaluate(
            (sig) => ({
              article: !!document.querySelector('article'),
              embed: !!document.querySelector(sig),
              relatedCount: document.querySelectorAll('section.related-stories a').length,
            }),
            variant.signature,
          ),
        url,
      );
      expect(result.article, `${variant.name}: <article> missing`).toBe(true);
      expect(result.embed, `${variant.name}: ${variant.signature} missing`).toBe(true);
      expect(
        result.relatedCount,
        `${variant.name}: related-stories link count out of bounds`,
      ).toBeGreaterThanOrEqual(MIN_RELATED);
      expect(result.relatedCount).toBeLessThanOrEqual(MAX_RELATED);
    });
  }
}
