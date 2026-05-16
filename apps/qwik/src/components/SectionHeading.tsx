import { component$, Slot } from '@qwik.dev/core';

interface Props {
  as?: 'h2' | 'h3';
}

const CLASS =
  'border-l-4 border-aj-orange pl-2 text-aj-orange mb-3 text-sm font-bold tracking-wider uppercase';

export const SectionHeading = component$<Props>(({ as = 'h3' }) => {
  return as === 'h2' ? (
    <h2 class={CLASS}>
      <Slot />
    </h2>
  ) : (
    <h3 class={CLASS}>
      <Slot />
    </h3>
  );
});
