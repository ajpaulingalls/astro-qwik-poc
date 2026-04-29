import { formatDate } from '../lib/format-date';
import { ArticleBody } from './ArticleBody';

export interface LiveBlogUpdate {
  id: string;
  title: string;
  shouldDisplayTitle: boolean;
  date: string;
  // Trusted CMS HTML — may carry Twitter/Brightcove/YouTube/gallery embeds.
  // ArticleBody dispatches embeds via parseEmbeds; raw injection would
  // strip the embed scripts and break interactive content.
  content: string;
}

interface Props {
  entry: LiveBlogUpdate;
}

export function LiveBlogEntry({ entry }: Props) {
  const { id, title, shouldDisplayTitle, date, content } = entry;
  return (
    <article
      data-entry-id={id}
      class="live-blog-entry border-l-2 border-neutral-200 pl-4 py-4 mb-4"
    >
      <time class="text-xs text-neutral-500" dateTime={date}>
        {formatDate(date)}
      </time>
      {shouldDisplayTitle && <h2 class="text-xl font-semibold mt-1">{title}</h2>}
      <ArticleBody content={content} />
    </article>
  );
}
