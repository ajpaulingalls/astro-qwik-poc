import { component$, Slot } from '@qwik.dev/core';

export const SectionHeading = component$(() => {
  return (
    <h3 class="text-aj-orange mb-3 text-sm font-bold tracking-wider uppercase">
      <Slot />
    </h3>
  );
});
