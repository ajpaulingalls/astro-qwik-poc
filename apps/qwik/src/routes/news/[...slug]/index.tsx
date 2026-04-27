import { component$ } from '@qwik.dev/core';
import { routeLoader$, type DocumentHead } from '@qwik.dev/router';
import { graphqlFetch, GraphqlHttpError } from '../../../lib/graphql';
import { getDisplayHeadline } from '../../../lib/headline';
import { ArticleHeader } from '../../../components/ArticleHeader';
import { ArticleBody } from '../../../components/ArticleBody';
import { RelatedStories, MAX_RELATED } from '../../../components/RelatedStories';
import type { HomepagePost, CuratedCollectionItem } from '@aje-poc/shared-types';

interface ArticleAuthor {
  id: string;
  name: string;
  link: string;
}

interface ArticleCategory {
  id: string;
  name: string;
  slug: string;
  link: string;
}

interface Article {
  id: string;
  title: string;
  subheading?: string;
  excerpt?: string;
  content: string;
  date: string;
  link: string;
  replacementHeadline?: string;
  featuredImage?: { sourceUrl: string; alt?: string; width?: number; height?: number } | null;
  author: ArticleAuthor[];
  categories: ArticleCategory[];
}

interface SingleArticleData {
  article: Article;
}

interface CuratedFeedData {
  homepage: { curatedCollection: CuratedCollectionItem[] };
}

// Production aljazeera.com slugs are the last segment of a nested URL like
// /features/2026/4/24/russian-oil-exports-slump... — the GraphQL query keys
// off the trailing segment only. Mock-api mirrors this contract.
function lastSegment(slug: string): string {
  const parts = slug.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

export const useArticleData = routeLoader$(async ({ params, fail }) => {
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
  const relatedPosts: HomepagePost[] = (
    curatedData.homepage.curatedCollection[0]?.posts ?? []
  ).slice(0, MAX_RELATED);
  return { article: articleData.article, relatedPosts };
});

export default component$(() => {
  const data = useArticleData();
  if ('notFound' in data.value) {
    return <main class="mx-auto max-w-3xl px-4 py-6">Article not found: {data.value.slug}</main>;
  }
  const { article, relatedPosts } = data.value;

  return (
    <article class="mx-auto max-w-3xl px-4 py-6">
      <ArticleHeader
        title={getDisplayHeadline(article)}
        subheading={article.subheading || article.excerpt}
        authors={article.author.map((a) => ({ name: a.name, link: a.link }))}
        date={article.date}
        categories={article.categories.map((c) => ({ name: c.name, link: c.link }))}
        featuredImage={article.featuredImage}
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
  return {
    title: data.article.title,
    meta: [{ name: 'description', content: data.article.excerpt ?? data.article.subheading ?? '' }],
  };
};
