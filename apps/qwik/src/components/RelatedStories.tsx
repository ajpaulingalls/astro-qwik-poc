import type { StoryCardData } from '@aje-poc/shared-types';
import { MAX_RELATED } from '../lib/related-posts';
import { SectionHeading } from './SectionHeading';
import { StoryCard } from './StoryCard';

interface Props {
  posts: StoryCardData[];
  title?: string;
}

export function RelatedStories({ posts, title = 'Related stories' }: Props) {
  if (posts.length === 0) return null;
  const visible = posts.slice(0, MAX_RELATED);
  return (
    <section class="related-stories mt-10 border-t border-neutral-200 pt-6">
      <SectionHeading as="h2">{title}</SectionHeading>
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((post) => (
          <StoryCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
