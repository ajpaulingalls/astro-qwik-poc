import { stripInlineStyles } from '@aje-poc/shared-csp';
import { parseEmbeds } from '../lib/parse-embeds';
import { TwitterEmbed } from './embeds/TwitterEmbed';
import { InstagramEmbed } from './embeds/InstagramEmbed';
import { GalleryEmbed } from './embeds/GalleryEmbed';
import { BrightcoveEmbed } from './embeds/BrightcoveEmbed';
import { YouTubeEmbed } from './embeds/YouTubeEmbed';

interface Props {
  content: string;
  // Test escape hatch: applied to raw HTML before segmentation. Lets test cases
  // mutate content without inventing fixture variants. Production callers do
  // not pass this.
  transformContent?: (html: string) => string;
}

// Content is trusted CMS HTML; CSP enforces script policy app-side (M5/M7).
// Embeds are dispatched by parseEmbeds; remaining text segments render
// verbatim via dangerouslySetInnerHTML AFTER stripInlineStyles removes any
// `style=""` attributes (CSP style-src-attr falls back to default-src 'self'
// and would block inline styles at runtime — see strip-inline-styles.ts).
export function ArticleBody({ content, transformContent }: Props) {
  const html = transformContent ? transformContent(content) : content;
  const segments = parseEmbeds(html);
  return (
    <article class="article-body prose max-w-none">
      {segments.map((seg, i) => {
        if (seg.kind === 'html') {
          return <div key={i} dangerouslySetInnerHTML={{ __html: stripInlineStyles(seg.html) }} />;
        }
        switch (seg.type) {
          case 'twitter':
            return <TwitterEmbed key={i} html={seg.html} />;
          case 'instagram':
            return <InstagramEmbed key={i} html={seg.html} />;
          case 'gallery':
            return <GalleryEmbed key={i} html={seg.html} />;
          case 'youtube':
            return <YouTubeEmbed key={i} html={seg.html} />;
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
    </article>
  );
}
