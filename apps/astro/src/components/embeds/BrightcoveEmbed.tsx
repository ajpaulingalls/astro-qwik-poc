// Brightcove player script src is per-video, derived from data-account and
// data-player attrs on the rendered <video-js>. We extract the attrs from the
// HTML before render (cheap regex — full markup parsing is overkill for two
// attributes) so the script tag is appended on the same render pass via the
// shared useEmbedScript hook. Missing attrs render the embed without a script
// — degrade silently rather than throw.
import { useEmbedScript } from '../../lib/use-embed-script';

interface Props {
  html: string;
}

const ATTR_ACCOUNT = /\bdata-account="([^"]+)"/;
const ATTR_PLAYER = /\bdata-player="([^"]+)"/;

function deriveScriptSrc(html: string): string | null {
  const account = ATTR_ACCOUNT.exec(html)?.[1];
  const player = ATTR_PLAYER.exec(html)?.[1];
  if (!account || !player) return null;
  return `https://players.brightcove.net/${account}/${player}_default/index.min.js`;
}

export function BrightcoveEmbed({ html }: Props) {
  useEmbedScript(deriveScriptSrc(html));
  return <div class="embed-brightcove" dangerouslySetInnerHTML={{ __html: html }} />;
}
