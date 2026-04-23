import lighthouse from 'lighthouse';
import { withChrome } from './chrome.ts';

export interface RawMetrics {
  lcp: number;
  cls: number;
  lhPerf: number;
  jsBytes: number;
}

export async function runLighthouseAudit(url: string): Promise<RawMetrics> {
  return withChrome(async (port) => {
    const result = await lighthouse(url, {
      port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance'],
    });
    if (!result || !result.lhr) {
      throw new Error(`runLighthouseAudit: no result for ${url}`);
    }
    return extractMetrics(result.lhr as unknown as Lhr);
  });
}

interface LhAudit {
  numericValue?: number;
  details?: { items?: Array<{ resourceType?: string; transferSize?: number }> };
}

interface Lhr {
  audits: Record<string, LhAudit>;
  categories: { performance: { score: number | null } };
}

function extractMetrics(lhr: Lhr): RawMetrics {
  const lcp = requireNumeric(lhr, 'largest-contentful-paint');
  const cls = requireNumeric(lhr, 'cumulative-layout-shift');
  const score = lhr.categories.performance.score;
  if (score === null) {
    throw new Error('lighthouse: performance category returned null score');
  }
  const lhPerf = Math.round(score * 100);

  const networkAudit = lhr.audits['network-requests'];
  if (!networkAudit?.details?.items) {
    throw new Error('lighthouse: audit "network-requests" missing details.items');
  }
  let jsBytes = 0;
  for (const item of networkAudit.details.items) {
    if (item.resourceType === 'Script') jsBytes += item.transferSize ?? 0;
  }

  return { lcp, cls, lhPerf, jsBytes };
}

function requireNumeric(lhr: Lhr, auditId: string): number {
  const v = lhr.audits[auditId]?.numericValue;
  if (typeof v !== 'number') {
    throw new Error(`lighthouse: audit "${auditId}" missing numericValue`);
  }
  return v;
}
