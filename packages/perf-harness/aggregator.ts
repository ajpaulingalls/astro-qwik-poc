export function median(samples: readonly number[]): number {
  if (samples.length === 0) {
    throw new Error('median: cannot aggregate an empty sample set');
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// R type 7 (Excel PERCENTILE / numpy default). Reduces to median() at
// p=0.5 — invariant pinned in aggregator_test.
export function percentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) {
    throw new Error('percentile: cannot aggregate an empty sample set');
  }
  if (!(p >= 0 && p <= 1)) {
    throw new Error(`percentile: p must be in [0, 1], got ${p}`);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = p * (sorted.length - 1);
  const floor = Math.floor(rank);
  const ceil = Math.ceil(rank);
  return sorted[floor] + (rank - floor) * (sorted[ceil] - sorted[floor]);
}
