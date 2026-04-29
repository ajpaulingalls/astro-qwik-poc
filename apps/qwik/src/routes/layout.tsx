import { component$, Slot, useVisibleTask$ } from '@qwik.dev/core';
import { Navigation } from '../components/Navigation';
import { BreakingTicker } from '../components/BreakingTicker';
import { Footer } from '../components/Footer';

export default component$(() => {
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    // Dynamic import keeps the web-vitals lib out of the SSR bundle.
    import('../lib/web-vitals');
  });

  return (
    <>
      <Navigation />
      <BreakingTicker />
      <main>
        <Slot />
      </main>
      <Footer />
    </>
  );
});
