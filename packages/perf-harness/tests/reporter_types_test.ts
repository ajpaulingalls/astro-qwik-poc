import { describe, it, expectTypeOf } from 'vitest';
import type { AggregatedMetric, AggregatedReport, MetricKey } from '../reporter.ts';

describe('AggregatedReport.metrics type', () => {
  it('has exactly the four literal metric keys', () => {
    expectTypeOf<MetricKey>().toEqualTypeOf<'lcp' | 'cls' | 'lhPerf' | 'jsBytes'>();
    expectTypeOf<AggregatedReport['metrics']>().toEqualTypeOf<
      Record<MetricKey, AggregatedMetric>
    >();
  });

  it('rejects arbitrary string keys (regression: was Record<string, AggregatedMetric>)', () => {
    expectTypeOf<AggregatedReport['metrics']>().not.toEqualTypeOf<
      Record<string, AggregatedMetric>
    >();
    expectTypeOf<keyof AggregatedReport['metrics']>().toEqualTypeOf<MetricKey>();
  });
});

describe('AggregatedMetric type', () => {
  it('has median + p95 + n (all required; median/p95 nullable)', () => {
    expectTypeOf<AggregatedMetric>().toEqualTypeOf<{
      median: number | null;
      p95: number | null;
      n: number;
    }>();
  });
});
