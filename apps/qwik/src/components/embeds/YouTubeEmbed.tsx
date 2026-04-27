import { component$ } from '@qwik.dev/core';

interface Props {
  html: string;
}

export const YouTubeEmbed = component$<Props>(({ html }) => {
  return <div class="embed-youtube" dangerouslySetInnerHTML={html} />;
});
