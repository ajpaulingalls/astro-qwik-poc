interface Props {
  children: preact.ComponentChildren;
  as?: 'h2' | 'h3';
}

const CLASS =
  'mb-3 pl-2 border-l-4 border-aj-orange text-aj-orange text-sm font-bold tracking-wider uppercase';

export function SectionHeading({ children, as = 'h3' }: Props) {
  return as === 'h2' ? <h2 class={CLASS}>{children}</h2> : <h3 class={CLASS}>{children}</h3>;
}
