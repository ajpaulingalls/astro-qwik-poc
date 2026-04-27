import type { JSXOutput } from '@qwik.dev/core';
import { parseEmbeds, type EmbedType } from '../lib/parse-embeds';
import { TwitterEmbed } from './embeds/TwitterEmbed';
import { InstagramEmbed } from './embeds/InstagramEmbed';
import { GalleryEmbed } from './embeds/GalleryEmbed';
import { BrightcoveEmbed } from './embeds/BrightcoveEmbed';

const WRAPPER_CLASS = 'article-body prose max-w-none';

const EMBED_COMPONENTS: Record<EmbedType, (props: { html: string }) => JSXOutput> = {
  twitter: TwitterEmbed,
  instagram: InstagramEmbed,
  gallery: GalleryEmbed,
  brightcove: BrightcoveEmbed,
};

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
        const Embed = EMBED_COMPONENTS[seg.type];
        return <Embed key={i} html={seg.html} />;
      })}
    </div>
  );
}
