import type { BreakingTicker } from '@aje-poc/shared-types';
import { graphqlFetch } from './graphql';

interface BreakingTickerData {
  breakingNews: BreakingTicker | null;
}

export async function fetchBreakingTicker(): Promise<BreakingTicker | null> {
  const data = await graphqlFetch<BreakingTickerData>({
    operationName: 'ArchipelagoBreakingTickerQuery',
  });
  return data.breakingNews;
}
