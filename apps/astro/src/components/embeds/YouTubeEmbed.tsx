import { safeInnerHTML } from '../../lib/safe-inner-html';

interface Props {
  html: string;
}

// Fidelity loss: padded-bottom aspect-ratio shim on the wrapper div. iframe
// sizing is controlled via the iframe's width/height attributes, so the
// player itself renders normally.
export function YouTubeEmbed({ html }: Props) {
  return <div class="embed-youtube" dangerouslySetInnerHTML={safeInnerHTML(html)} />;
}
