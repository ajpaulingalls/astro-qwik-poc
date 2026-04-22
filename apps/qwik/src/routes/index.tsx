import { component$ } from '@qwik.dev/core';
import { routeLoader$, type DocumentHead } from '@qwik.dev/router';
import { graphqlFetch } from '../lib/graphql';

interface HomePageQueryData {
  homepage: {
    layout: string;
  };
}

export const useHomepageData = routeLoader$(async () => {
  const data = await graphqlFetch<HomePageQueryData>({
    operationName: 'HomePageQuery',
    variables: { isAtf: true, atfLength: 2, slug: '', preview: '' },
  });
  return data;
});

export default component$(() => {
  const data = useHomepageData();
  return (
    <main>
      <h1>aje-poc-qwik</h1>
      <p>HomePageQuery layout: {data.value.homepage.layout}</p>
    </main>
  );
});

export const head: DocumentHead = {
  title: 'AJE PoC — Qwik 2',
};
