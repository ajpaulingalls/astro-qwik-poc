import { component$ } from '@qwik.dev/core';
import { routeLoader$, type DocumentHead, type RequestEventLoader } from '@qwik.dev/router';
import { graphqlFetch, GraphqlHttpError } from '../../../lib/graphql';
import { getDisplayHeadline } from '../../../lib/headline';
import { relatedPostsFrom } from '../../../lib/related-posts';
import { computeLcpPreloadLink } from '../../../lib/lcp-preload';
import { ArticleHeader } from '../../../components/ArticleHeader';
import { ArticleBody } from '../../../components/ArticleBody';
import { RelatedStories } from '../../../components/RelatedStories';
import type { Article, CuratedCollectionItem, HomepagePost } from '@aje-poc/shared-types';

interface SingleArticleData {
  article: Article;
}

interface CuratedFeedData {
  homepage: { curatedCollection: CuratedCollectionItem[] };
}

export interface ArticleLoaderResult {
  article: Article;
  relatedPosts: HomepagePost[];
}

// Production aljazeera.com slugs are the last segment of a nested URL like
// /features/2026/4/24/russian-oil-exports-slump... — the GraphQL query keys
// off the trailing segment only. Mock-api mirrors this contract.
function lastSegment(slug: string): string {
  const parts = slug.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

// Exported for unit tests — `routeLoader$` wraps this directly. Behavior is
// the same; naming the body lets vitest call it without a Qwik runtime.
export async function loadArticleData(
  ctx: Pick<RequestEventLoader, 'params' | 'fail'>,
): Promise<ArticleLoaderResult | { notFound: true; slug: string }> {
  const { params, fail } = ctx;
  const articleSlug = lastSegment(params.slug ?? '');
  let articleData: SingleArticleData;
  let curatedData: CuratedFeedData;
  try {
    [articleData, curatedData] = await Promise.all([
      graphqlFetch<SingleArticleData>({
        operationName: 'ArchipelagoSingleArticleQuery',
        variables: { name: articleSlug, preview: '' },
      }),
      graphqlFetch<CuratedFeedData>({
        operationName: 'HomePageCuratedFeedQuery',
        variables: { offset: 0 },
      }),
    ]);
  } catch (err) {
    // Mock-api returns HTTP 404 when no fixture matches the slug. Translate to
    // a route 404 via fail() so the response carries the right status instead
    // of a 500 from an uncaught error.
    if (err instanceof GraphqlHttpError && err.status === 404) {
      return fail(404, { notFound: true, slug: articleSlug });
    }
    throw err;
  }
  // Return only what the page renders. Qwik 2 serializes the full loader value
  // into the resume payload, so trimming here directly shrinks what ships to
  // the browser — the in-component slice would not.
  const relatedPosts = relatedPostsFrom(curatedData.homepage.curatedCollection ?? []);
  return { article: articleData.article, relatedPosts };
}

export const useArticleData = routeLoader$((ctx) => loadArticleData(ctx));

export default component$(() => {
  const data = useArticleData();
  if ('notFound' in data.value) {
    // Layout owns the <main> landmark — content wrapper stays a <div> to
    // avoid nested-main (HTML5 forbids; perf-harness asserts exactly 1).
    return <div class="mx-auto max-w-3xl px-4 py-6">Article not found: {data.value.slug}</div>;
  }
  const { article, relatedPosts } = data.value;

  return (
    <article class="mx-auto max-w-3xl px-4 py-6">
      <ArticleHeader
        article={{
          ...article,
          title: getDisplayHeadline(article),
          subheading: article.subheading || article.excerpt,
        }}
      />
      <ArticleBody content={article.content} />
      <RelatedStories posts={relatedPosts} />
    </article>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const data = resolveValue(useArticleData);
  if ('notFound' in data) {
    return { title: 'Article not found' };
  }
  const preloadLink = computeLcpPreloadLink(data.article.featuredImage);
  return {
    title: data.article.title,
    meta: [{ name: 'description', content: data.article.excerpt ?? data.article.subheading ?? '' }],
    ...(preloadLink && { links: [preloadLink] }),
  };
};
