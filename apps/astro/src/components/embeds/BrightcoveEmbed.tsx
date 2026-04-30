import { stripInlineStyles } from '@aje-poc/shared-csp';
import { useEmbedScript } from '../../lib/use-embed-script';

interface Props {
  html: string;
  account: string;
  player: string;
}

// CMS Brightcove markup ships with inline style="" attributes (display,
// position, padding-top aspect-ratio shim) that violate the Astro CSP.
// stripInlineStyles removes them before the dangerouslySetInnerHTML; the
// brightcove player JS reapplies its own sizing once it boots, so the
// initial visual fidelity loss is just the pre-boot aspect-ratio shim.
export function BrightcoveEmbed({ html, account, player }: Props) {
  useEmbedScript(`https://players.brightcove.net/${account}/${player}_default/index.min.js`);
  return (
    <div class="embed-brightcove" dangerouslySetInnerHTML={{ __html: stripInlineStyles(html) }} />
  );
}
