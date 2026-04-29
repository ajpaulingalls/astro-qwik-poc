import type { LiveBlogShell } from '@aje-poc/shared-types';
import { graphqlFetch } from './graphql';

export interface LiveBlogUpdate {
  id: string;
  title: string;
  // Production sometimes returns updates whose title is internal-only and
  // should not render (e.g., a tweet-only update). Honored by LiveBlogEntry.
  shouldDisplayTitle: boolean;
  content: string;
  date: string;
}

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
