interface Props {
  children: preact.ComponentChildren;
  as?: 'h2' | 'h3';
}

const CLASS = 'text-aj-orange mb-3 text-sm font-bold tracking-wider uppercase';

export function SectionHeading({ children, as = 'h3' }: Props) {
  return as === 'h2' ? <h2 class={CLASS}>{children}</h2> : <h3 class={CLASS}>{children}</h3>;
}
