import type { HomepageImage } from '@aje-poc/shared-types';
import { formatDate } from '../lib/format-date';
import { LeadImage } from './LeadImage';
import { LiveBadge } from './LiveBadge';

export interface LiveBlogHeaderData {
  title: string;
  subheading?: string;
  excerpt?: string;
  isLive: boolean;
  date: string;
  featuredImage?: HomepageImage | null;
}

interface Props {
  header: LiveBlogHeaderData;
}

export function LiveBlogHeader({ header }: Props) {
  const { title, subheading, excerpt, isLive, date, featuredImage } = header;
  const description = subheading ?? excerpt;
  return (
    <header class="live-blog-header mb-6">
      <div class="flex items-center gap-2 mb-2">
        <LiveBadge isLive={isLive} />
        <time class="text-sm text-neutral-600" dateTime={date}>
          {formatDate(date)}
        </time>
      </div>
      <h1 class="text-3xl md:text-4xl font-bold leading-tight">{title}</h1>
      {description && <p class="subheading mt-3 text-lg text-neutral-700">{description}</p>}
      {featuredImage && (
        <LeadImage
          image={featuredImage}
          priority="eager"
          sizes="(min-width: 768px) 768px, 100vw"
          extraClass="lead-image mt-4"
        />
      )}
    </header>
  );
}
