import { useEmbedScript } from '../../lib/use-embed-script';

const SCRIPT_SRC = 'https://platform.twitter.com/widgets.js';

interface Props {
  html: string;
}

export function TwitterEmbed({ html }: Props) {
  useEmbedScript(SCRIPT_SRC);
  return <div class="embed-twitter" dangerouslySetInnerHTML={{ __html: html }} />;
}
