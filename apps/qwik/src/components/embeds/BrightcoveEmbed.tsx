import { component$, useOnDocument, $ } from '@qwik.dev/core';
import { injectEmbedScript } from '../../lib/inject-embed-script';

interface Props {
  html: string;
  account: string;
  player: string;
}

export const BrightcoveEmbed = component$<Props>(({ html, account, player }) => {
  const src = `https://players.brightcove.net/${account}/${player}_default/index.min.js`;
  useOnDocument(
    'qvisible',
    $(() => {
      injectEmbedScript(src);
    }),
  );
  return <div class="embed-brightcove" dangerouslySetInnerHTML={html} />;
});
