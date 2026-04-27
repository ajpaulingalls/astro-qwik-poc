import type { JSXOutput } from '@qwik.dev/core';
import { parseEmbeds } from '../lib/parse-embeds';
import { TwitterEmbed } from './embeds/TwitterEmbed';
import { InstagramEmbed } from './embeds/InstagramEmbed';
import { GalleryEmbed } from './embeds/GalleryEmbed';
import { BrightcoveEmbed } from './embeds/BrightcoveEmbed';

const WRAPPER_CLASS = 'article-body prose max-w-none';

interface Props {
  content: string;
  // Test escape hatch: applied to raw HTML before segmentation. Lets test cases
  // mutate content without inventing fixture variants. Production callers do
  // not pass this.
  embedRenderer?: (html: string) => JSXOutput;
}

// Content is trusted CMS HTML. Embeds are dispatched by parseEmbeds; remaining
// text segments render verbatim via dangerouslySetInnerHTML. The embedRenderer
// escape hatch is applied BEFORE segmentation when present.
export function ArticleBody({ content, embedRenderer }: Props) {
  if (embedRenderer) {
    return <div class={WRAPPER_CLASS}>{embedRenderer(content)}</div>;
  }
  const segments = parseEmbeds(content);
  return (
    <div class={WRAPPER_CLASS}>
      {segments.map((seg, i) => {
        if (seg.kind === 'html') {
          return <div key={i} dangerouslySetInnerHTML={seg.html} />;
        }
        switch (seg.type) {
          case 'twitter':
            return <TwitterEmbed key={i} html={seg.html} />;
          case 'instagram':
            return <InstagramEmbed key={i} html={seg.html} />;
          case 'gallery':
            return <GalleryEmbed key={i} html={seg.html} />;
          case 'brightcove':
            return (
              <BrightcoveEmbed key={i} html={seg.html} account={seg.account} player={seg.player} />
            );
          default: {
            const _exhaustive: never = seg;
            return _exhaustive;
          }
        }
      })}
    </div>
  );
}
