import type { StoryCardData } from '@aje-poc/shared-types';
import { getDisplayHeadline } from '../lib/headline';
import { DISPLAY_HEADLINE_CLASS } from '../lib/typography';
import { LeadImage } from './LeadImage';
import { LiveBadge } from './LiveBadge';

interface Props {
  post: StoryCardData;
}

export function HeroCard({ post }: Props) {
  const img = post.featuredImage ?? null;
  return (
    <article>
      <a href={post.link} class="block">
        {img && (
          <LeadImage image={img} priority="eager" sizes="(min-width: 1024px) 1024px, 100vw" />
        )}
        <div class="px-4 py-3">
          <LiveBadge isLive={post.isLive} size="lg" />
          <h2 class={`mt-1 ${DISPLAY_HEADLINE_CLASS}`}>{getDisplayHeadline(post)}</h2>
          {post.excerpt && (
            <p class="excerpt mt-3 text-base leading-relaxed text-neutral-800">{post.excerpt}</p>
          )}
        </div>
      </a>
    </article>
  );
}
