import { component$, useOnDocument, $ } from '@qwik.dev/core';
import { injectEmbedScript } from '../../lib/inject-embed-script';

const SCRIPT_SRC = 'https://platform.twitter.com/widgets.js';

interface Props {
  html: string;
}

export const TwitterEmbed = component$<Props>(({ html }) => {
  useOnDocument(
    'qvisible',
    $(() => {
      injectEmbedScript(SCRIPT_SRC);
    }),
  );
  return <div class="embed-twitter" dangerouslySetInnerHTML={html} />;
});
