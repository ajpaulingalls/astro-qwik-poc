import { safeInnerHTML } from '../../lib/safe-inner-html';
import { useEmbedScript } from '../../lib/use-embed-script';

const SCRIPT_SRC = 'https://www.instagram.com/embed.js';

interface Props {
  html: string;
}

// Fidelity loss: pre-script placeholder shape (background-color, padding,
// border, max-width). instgrm.Embeds reprocesses the DOM after the script
// loads and replaces the placeholder with its own iframe sized via
// attributes — so the post-load render is unaffected.
export function InstagramEmbed({ html }: Props) {
  useEmbedScript(SCRIPT_SRC, {
    onload: () => {
      window.instgrm?.Embeds?.process?.();
    },
  });
  return <div class="embed-instagram" dangerouslySetInnerHTML={safeInnerHTML(html)} />;
}
