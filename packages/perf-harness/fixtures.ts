// Path keyed off the recorded snapshot slug + date, so perf-harness pages
// and the acceptance suite resolve the same post the mock-api fixtures expect.
import { LIVEBLOG_DATE_PREFIX, LIVEBLOG_SLUG } from '@aje-poc/shared-types';

export const LIVEBLOG_PATH = `/news/liveblog/${LIVEBLOG_DATE_PREFIX}/${LIVEBLOG_SLUG}`;
