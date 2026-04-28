interface Props {
  html: string;
}

// Leaf component — see apps/qwik/docs/QWIK2_NOTES.md "Leaf component convention".
// No signals, no $()-wrapped handlers, no Slot. component$ would emit a QRL chunk
// for pure overhead; plain function lands inline at each call site.
export function GalleryEmbed({ html }: Props) {
  return <div class="embed-gallery" dangerouslySetInnerHTML={html} />;
}
