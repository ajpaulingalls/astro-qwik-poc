// Brightcove player script src is per-video, derived from data-account and
// data-player attrs on the rendered <video-js>. Component extracts the attrs
// before render (cheap regex; full parsing is overkill for two attributes)
// then injects the script via useOnDocument('qvisible'). Missing attrs render
// the embed without a script — degrade silently rather than throw.
import { component$, useOnDocument, $ } from '@qwik.dev/core';
import { injectEmbedScript } from '../../lib/inject-embed-script';

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

export const BrightcoveEmbed = component$<Props>(({ html }) => {
  const src = deriveScriptSrc(html);
  useOnDocument(
    'qvisible',
    $(() => {
      injectEmbedScript(src);
    }),
  );
  return <div class="embed-brightcove" dangerouslySetInnerHTML={html} />;
});
