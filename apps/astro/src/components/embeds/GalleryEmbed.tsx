import { safeInnerHTML } from '../../lib/safe-inner-html';

interface Props {
  html: string;
}

// Fidelity loss: figure/figcaption column widths from the CMS — gallery
// layout degrades to the parent .embed-gallery class styling. Verified
// in the sprint-012 M1 liveblog sweep.
export function GalleryEmbed({ html }: Props) {
  return <div class="embed-gallery" dangerouslySetInnerHTML={safeInnerHTML(html)} />;
}
