import { useEmbedScript } from '../../lib/use-embed-script';

interface Props {
  html: string;
  account: string;
  player: string;
}

export function BrightcoveEmbed({ html, account, player }: Props) {
  useEmbedScript(`https://players.brightcove.net/${account}/${player}_default/index.min.js`);
  return <div class="embed-brightcove" dangerouslySetInnerHTML={{ __html: html }} />;
}
