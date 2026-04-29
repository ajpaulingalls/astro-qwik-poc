import type { LiveBlogShell } from '@aje-poc/shared-types';
import { graphqlFetch } from './graphql';
import type { LiveBlogUpdate } from '../components/LiveBlogEntry';

interface SingleLiveBlogData {
  article: LiveBlogShell;
}

interface LiveBlogUpdateData {
  posts: LiveBlogUpdate;
}

export async function fetchLiveBlogShell(slug: string): Promise<LiveBlogShell> {
  const data = await graphqlFetch<SingleLiveBlogData>({
    operationName: 'ArchipelagoSingleLiveBlogQuery',
    variables: { name: slug, preview: '' },
  });
  return data.article;
}

export async function fetchLiveBlogUpdate(postID: number): Promise<LiveBlogUpdate> {
  const data = await graphqlFetch<LiveBlogUpdateData>({
    operationName: 'LiveBlogUpdateQuery',
    variables: { postID, postType: 'liveblog-update', preview: '', isAmp: false },
  });
  return data.posts;
}
