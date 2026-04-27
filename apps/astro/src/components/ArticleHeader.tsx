import type { Article } from '@aje-poc/shared-types';
import { formatDate } from '../lib/format-date';
import { LeadImage } from './LeadImage';

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
        <LeadImage image={article.featuredImage} priority="eager" extraClass="lead-image my-4" />
      )}
      <div class="flex flex-wrap items-center gap-x-3 text-sm text-neutral-600">
        {article.author.length > 0 && (
          <span class="byline">
            By{' '}
            {article.author.map((a, i) => (
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
          </span>
        )}
        <time datetime={article.date}>{formatDate(article.date)}</time>
      </div>
    </header>
  );
}
