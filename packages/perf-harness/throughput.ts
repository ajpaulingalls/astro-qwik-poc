export function parseDuration(s: string): number {
  const match = /^([1-9]\d*)(ms|s)$/.exec(s);
  if (!match) {
    throw new Error(
      `invalid duration: ${JSON.stringify(s)} (expected positive integer with unit, e.g. "10s" or "500ms")`,
    );
  }
  const value = Number.parseInt(match[1], 10);
  return match[2] === 's' ? value * 1000 : value;
}
