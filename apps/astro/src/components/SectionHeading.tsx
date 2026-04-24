interface Props {
  children: preact.ComponentChildren;
}

export function SectionHeading({ children }: Props) {
  return <h3 class="text-aj-orange mb-3 text-sm font-bold tracking-wider uppercase">{children}</h3>;
}
