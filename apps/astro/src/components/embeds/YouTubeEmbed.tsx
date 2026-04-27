interface Props {
  html: string;
}

export function YouTubeEmbed({ html }: Props) {
  return <div class="embed-youtube" dangerouslySetInnerHTML={{ __html: html }} />;
}
