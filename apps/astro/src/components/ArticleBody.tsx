import { parseEmbeds, type EmbedType } from '../lib/parse-embeds';
import { TwitterEmbed } from './embeds/TwitterEmbed';
import { InstagramEmbed } from './embeds/InstagramEmbed';
import { GalleryEmbed } from './embeds/GalleryEmbed';
import { BrightcoveEmbed } from './embeds/BrightcoveEmbed';

const EMBED_COMPONENTS: Record<EmbedType, (props: { html: string }) => preact.JSX.Element> = {
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
  transformContent?: (html: string) => string;
}

// Content is trusted CMS HTML; CSP enforces script policy app-side (M5/M7).
// Embeds are dispatched by parseEmbeds; remaining text segments render
// verbatim via dangerouslySetInnerHTML.
export function ArticleBody({ content, transformContent }: Props) {
  const html = transformContent ? transformContent(content) : content;
  const segments = parseEmbeds(html);
  return (
    <article class="article-body prose max-w-none">
      {segments.map((seg, i) => {
        if (seg.kind === 'html') {
          return <div key={i} dangerouslySetInnerHTML={{ __html: seg.html }} />;
        }
        const Embed = EMBED_COMPONENTS[seg.type];
        return <Embed key={i} html={seg.html} />;
      })}
    </article>
  );
}
