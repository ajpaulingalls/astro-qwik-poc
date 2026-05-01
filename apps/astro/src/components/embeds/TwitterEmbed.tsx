import { safeInnerHTML } from '../../lib/safe-inner-html';
import { useEmbedScript } from '../../lib/use-embed-script';

const SCRIPT_SRC = 'https://platform.twitter.com/widgets.js';

interface Props {
  html: string;
}

// Fidelity loss: none today — current tweet markup carries no inline
// style. safeInnerHTML is the structural defense if a future variant adds
// one (matches the pattern used by sibling embeds).
export function TwitterEmbed({ html }: Props) {
  useEmbedScript(SCRIPT_SRC);
  return <div class="embed-twitter" dangerouslySetInnerHTML={safeInnerHTML(html)} />;
}
