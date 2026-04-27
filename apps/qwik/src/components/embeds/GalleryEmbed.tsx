import { component$ } from '@qwik.dev/core';

interface Props {
  html: string;
}

export const GalleryEmbed = component$<Props>(({ html }) => {
  return <div class="embed-gallery" dangerouslySetInnerHTML={html} />;
});
