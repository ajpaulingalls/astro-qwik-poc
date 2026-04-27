import { useEmbedScript } from '../../lib/use-embed-script';

const SCRIPT_SRC = 'https://www.instagram.com/embed.js';

interface Props {
  html: string;
}

export function InstagramEmbed({ html }: Props) {
  useEmbedScript(SCRIPT_SRC, {
    onload: () => {
      window.instgrm?.Embeds?.process?.();
    },
  });
  return <div class="embed-instagram" dangerouslySetInnerHTML={{ __html: html }} />;
}
