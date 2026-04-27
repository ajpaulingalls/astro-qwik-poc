import type { Article } from '@aje-poc/shared-types';
import { resolveImageUrl } from '../lib/image-url';
import { formatDate } from '../lib/format-date';

interface Props {
  article: Article;
}

export function ArticleHeader({ article }: Props) {
  return (
    <header class="article-header mb-6">
      {article.categories.length > 0 && (
        <ul class="categories flex gap-2 text-sm uppercase tracking-wider text-aj-orange mb-2">
          {article.categories.map((cat) => (
            <li key={cat.slug}>
              <a href={cat.link} class="hover:underline">
                {cat.name}
              </a>
            </li>
          ))}
        </ul>
      )}
      <h1 class="text-3xl font-bold leading-tight mb-3">{article.title}</h1>
      {article.subheading && (
        <p class="subheading text-lg text-neutral-700 mb-4">{article.subheading}</p>
      )}
      {article.featuredImage && (
        <img
          class="lead-image my-4 w-full h-auto rounded aspect-[3/2] object-cover"
          src={resolveImageUrl(article.featuredImage.sourceUrl)}
          alt={article.featuredImage.alt ?? ''}
          width={article.featuredImage.width}
          height={article.featuredImage.height}
          loading="eager"
          fetchpriority="high"
          decoding="async"
        />
      )}
      <div class="flex flex-wrap items-center gap-x-3 text-sm text-neutral-600">
        {article.author.length > 0 && (
          <span class="byline">
            By{' '}
            {article.author.map((a, i) => (
              <span key={a.link}>
                {i > 0 && ', '}
                <a href={a.link} class="hover:text-aj-orange font-medium">
                  {a.name}
                </a>
              </span>
            ))}
          </span>
        )}
        <time datetime={article.date}>{formatDate(article.date)}</time>
      </div>
    </header>
  );
}
