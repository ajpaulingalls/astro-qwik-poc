import { component$, useOnDocument, $ } from '@qwik.dev/core';
import { injectEmbedScript } from '../../lib/inject-embed-script';

const SCRIPT_SRC = 'https://www.instagram.com/embed.js';

interface Props {
  html: string;
}

declare global {
  interface Window {
    instgrm?: { Embeds?: { process?: () => void } };
  }
}

export const InstagramEmbed = component$<Props>(({ html }) => {
  useOnDocument(
    'qvisible',
    $(() => {
      injectEmbedScript(SCRIPT_SRC, {
        onload: () => {
          window.instgrm?.Embeds?.process?.();
        },
      });
    }),
  );
  return <div class="embed-instagram" dangerouslySetInnerHTML={html} />;
});
