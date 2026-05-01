import { safeInnerHTML } from '../../lib/safe-inner-html';
import { useEmbedScript } from '../../lib/use-embed-script';

interface Props {
  html: string;
  account: string;
  player: string;
}

// Fidelity loss: pre-boot aspect-ratio shim. The Brightcove player JS
// reapplies sizing once it loads, so the only visible regression is the
// brief moment between SSR paint and player boot.
export function BrightcoveEmbed({ html, account, player }: Props) {
  useEmbedScript(`https://players.brightcove.net/${account}/${player}_default/index.min.js`);
  return <div class="embed-brightcove" dangerouslySetInnerHTML={safeInnerHTML(html)} />;
}
