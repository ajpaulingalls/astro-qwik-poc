import type { JSXOutput } from '@qwik.dev/core';

interface Props {
  content: string;
  embedRenderer?: (html: string) => JSXOutput;
}

const WRAPPER_CLASS = 'article-body prose max-w-none';

export function ArticleBody({ content, embedRenderer }: Props) {
  if (embedRenderer) {
    return <div class={WRAPPER_CLASS}>{embedRenderer(content)}</div>;
  }
  return <div class={WRAPPER_CLASS} dangerouslySetInnerHTML={content} />;
}
