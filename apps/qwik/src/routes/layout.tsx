import { component$, Slot, useVisibleTask$ } from '@qwik.dev/core';

export default component$(() => {
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    // Dynamic import keeps the web-vitals lib out of the SSR bundle.
    import('../lib/web-vitals');
  });

  return <Slot />;
});
