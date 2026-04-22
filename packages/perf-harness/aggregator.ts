export function median(samples: readonly number[]): number {
  if (samples.length === 0) {
    throw new Error('median: cannot aggregate an empty sample set');
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
