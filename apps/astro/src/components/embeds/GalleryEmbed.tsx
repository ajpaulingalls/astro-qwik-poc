interface Props {
  html: string;
}

export function GalleryEmbed({ html }: Props) {
  return <div class="embed-gallery" dangerouslySetInnerHTML={{ __html: html }} />;
}
