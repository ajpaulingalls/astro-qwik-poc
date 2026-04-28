import { formatDate } from '../lib/format-date';
import { LeadImage } from './LeadImage';
import type { Article } from '@aje-poc/shared-types';

interface Props {
  article: Article;
}

export function ArticleHeader({ article }: Props) {
  const { title, subheading, author, date, categories, featuredImage } = article;
  return (
    <header class="article-header mb-6">
      {categories.length > 0 && (
        <ul class="categories flex gap-2 text-sm uppercase tracking-wider text-aj-orange mb-2">
          {categories.map((cat) => (
            <li key={cat.slug}>
              <a href={cat.link} class="hover:underline">
                {cat.name}
              </a>
            </li>
          ))}
        </ul>
      )}
      <h1 class="text-3xl md:text-4xl font-bold leading-tight">{title}</h1>
      {subheading && <p class="subheading mt-3 text-lg text-neutral-700">{subheading}</p>}
      {featuredImage && (
        <LeadImage
          image={featuredImage}
          priority="eager"
          sizes="(min-width: 768px) 768px, 100vw"
          extraClass="lead-image mt-4"
        />
      )}
      <div class="byline mt-4 text-sm text-neutral-600 flex flex-wrap gap-x-2">
        <span>By </span>
        {author.map((a, i) => (
          <span key={a.link ?? a.name}>
            {i > 0 && ', '}
            {a.link ? (
              <a href={a.link} class="hover:text-aj-orange font-medium">
                {a.name}
              </a>
            ) : (
              <span class="font-medium">{a.name}</span>
            )}
          </span>
        ))}
        <span class="mx-1">·</span>
        <time dateTime={date}>{formatDate(date)}</time>
      </div>
    </header>
  );
}
