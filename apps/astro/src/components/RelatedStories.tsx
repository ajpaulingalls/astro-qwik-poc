import type { StoryCardData } from '@aje-poc/shared-types';
import { getDisplayHeadline } from '../lib/headline';
import { SectionHeading } from './SectionHeading';

interface Props {
  posts: StoryCardData[];
}

// Trusts producer for cap (matches CuratedCollection / MostPopular sibling convention).
// MAX_RELATED lives in lib/related-posts.ts — this component just renders what it's given.
export function RelatedStories({ posts }: Props) {
  if (posts.length === 0) return null;
  return (
    <section class="related-stories mt-10 border-t pt-6">
      <SectionHeading as="h2">Related stories</SectionHeading>
      <ul class="space-y-3">
        {posts.map((post) => (
          <li key={post.id}>
            <a href={post.link} class="hover:text-aj-orange text-neutral-700">
              {getDisplayHeadline(post)}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
