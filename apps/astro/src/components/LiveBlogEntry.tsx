import type { LiveBlogUpdate } from '../lib/load-liveblog';
import { formatDate } from '../lib/format-date';
import { ArticleBody } from './ArticleBody';

interface Props {
  entry: LiveBlogUpdate;
}

export function LiveBlogEntry({ entry }: Props) {
  const { id, title, shouldDisplayTitle, date, content } = entry;
  // Outer is <section>, not <article>: ArticleBody itself emits <article>, so a
  // <section data-entry-id> wrapper avoids invalid <article><article> nesting.
  return (
    <section
      data-entry-id={id}
      class="live-blog-entry border-l-2 border-neutral-200 pl-4 py-4 mb-4"
    >
      <time class="text-xs text-neutral-500" dateTime={date}>
        {formatDate(date)}
      </time>
      {shouldDisplayTitle && <h2 class="text-xl font-semibold mt-1">{title}</h2>}
      <ArticleBody content={content} />
    </section>
  );
}
