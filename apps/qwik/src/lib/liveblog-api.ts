import type { LiveBlogShell, LiveBlogUpdate } from '@aje-poc/shared-types';
import { graphqlFetch } from './graphql';

interface SingleLiveBlogData {
  article: LiveBlogShell | null;
}

interface LiveBlogUpdateData {
  // Per-update payload may be null when the postID 404s (no_posts_found).
  posts: LiveBlogUpdate | null;
}

export async function fetchLiveBlogShell(slug: string): Promise<LiveBlogShell | null> {
  const data = await graphqlFetch<SingleLiveBlogData>({
    operationName: 'ArchipelagoSingleLiveBlogQuery',
    // postType: 'liveblog' required by production API; omitting returns no_posts_found.
    variables: { name: slug, postType: 'liveblog', preview: '' },
  });
  return data.article;
}

export async function fetchLiveBlogUpdate(postID: number): Promise<LiveBlogUpdate | null> {
  const data = await graphqlFetch<LiveBlogUpdateData>({
    operationName: 'LiveBlogUpdateQuery',
    variables: { postID, postType: 'liveblog-update', preview: '', isAmp: false },
  });
  return data.posts;
}
