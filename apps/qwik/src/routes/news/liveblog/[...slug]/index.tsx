import { component$ } from '@qwik.dev/core';
import { routeLoader$, type DocumentHead, type RequestEventLoader } from '@qwik.dev/router';
import { graphqlFetch, GraphqlHttpError } from '../../../../lib/graphql';
import type { HomepageImage, LiveBlogChildrenIds, LiveBlogShell } from '@aje-poc/shared-types';

const INITIAL_ENTRY_COUNT = 5;

// Per-update payload shape — narrow projection of the production
// LiveBlogUpdateQuery response. Only fields the entry component renders
// are kept so the resume payload stays small.
export interface LiveBlogUpdate {
  id: string;
  title: string;
  shouldDisplayTitle: boolean;
  date: string;
  content: string;
}

export interface LiveBlogHeaderData {
  title: string;
  subheading?: string;
  excerpt?: string;
  isLive: boolean;
  date: string;
  featuredImage?: HomepageImage | null;
}

export interface LiveBlogLoaderSuccess {
  slug: string;
  header: LiveBlogHeaderData;
  entries: LiveBlogUpdate[];
  initialChildIds: LiveBlogChildrenIds;
}

interface SingleLiveBlogData {
  article: LiveBlogShell;
}

interface LiveBlogUpdateData {
  posts: LiveBlogUpdate;
}

function lastSegment(slug: string): string {
  const parts = slug.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

async function fetchUpdate(postID: number): Promise<LiveBlogUpdate> {
  const data = await graphqlFetch<LiveBlogUpdateData>({
    operationName: 'LiveBlogUpdateQuery',
    variables: { postID, postType: 'liveblog-update', preview: '', isAmp: false },
  });
  return data.posts;
}

// Exported for unit tests — `routeLoader$` wraps this directly.
export async function loadLiveBlogData(
  ctx: Pick<RequestEventLoader, 'params' | 'fail'>,
): Promise<LiveBlogLoaderSuccess | { notFound: true; slug: string }> {
  const { params, fail } = ctx;
  const slug = lastSegment(params.slug ?? '');
  let shellData: SingleLiveBlogData;
  try {
    shellData = await graphqlFetch<SingleLiveBlogData>({
      operationName: 'ArchipelagoSingleLiveBlogQuery',
      variables: { name: slug, preview: '' },
    });
  } catch (err) {
    if (err instanceof GraphqlHttpError && err.status === 404) {
      return fail(404, { notFound: true, slug });
    }
    throw err;
  }

  const shell = shellData.article;
  // Per-update fan-out: childrenMeta carries each entry's post ID. Using
  // allSettled (not all) because individual updates can be deleted between
  // shell-fetch and update-fetch; one missing entry shouldn't 404 the route.
  const meta = shell.childrenMeta ?? [];
  const targets = meta.slice(0, INITIAL_ENTRY_COUNT).map((m) => Number(m.id));
  const settled = await Promise.allSettled(targets.map(fetchUpdate));
  const entries = settled
    .filter((s): s is PromiseFulfilledResult<LiveBlogUpdate> => s.status === 'fulfilled')
    .map((s) => s.value);

  // Trim to render-needed shape only. Qwik 2 serializes the full loader
  // value into the resume payload, so projecting here directly shrinks
  // what ships to the browser.
  const header: LiveBlogHeaderData = {
    title: shell.title,
    subheading: shell.subheading,
    excerpt: shell.excerpt,
    isLive: shell.isLive,
    date: shell.date,
    featuredImage: shell.featuredImage,
  };
  return {
    slug,
    header,
    entries,
    initialChildIds: shell.children,
  };
}

export const useLiveBlogData = routeLoader$((ctx) => loadLiveBlogData(ctx));

export default component$(() => {
  const data = useLiveBlogData();
  if ('notFound' in data.value) {
    return <div class="mx-auto max-w-3xl px-4 py-6">Live blog not found: {data.value.slug}</div>;
  }
  const { header } = data.value;
  return (
    <article class="mx-auto max-w-3xl px-4 py-6">
      <h1 class="text-3xl md:text-4xl font-bold leading-tight">{header.title}</h1>
    </article>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const data = resolveValue(useLiveBlogData);
  if ('notFound' in data) {
    return { title: 'Live blog not found' };
  }
  return {
    title: data.header.title,
    meta: [{ name: 'description', content: data.header.excerpt ?? data.header.subheading ?? '' }],
  };
};
