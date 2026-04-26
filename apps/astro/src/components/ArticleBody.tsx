interface Props {
  content: string;
  transformContent?: (html: string) => string;
}

// Content is trusted CMS HTML; CSP enforces script policy app-side (M5/M7).
export function ArticleBody({ content, transformContent }: Props) {
  const html = transformContent ? transformContent(content) : content;
  return (
    <article class="article-body prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
