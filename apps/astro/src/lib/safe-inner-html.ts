import { stripInlineStyles } from '@aje-poc/shared-csp';

// Single seam for every dangerouslySetInnerHTML site in the Astro app.
// Wraps stripInlineStyles + the JSX `__html` shape so a future embed
// component CANNOT skip the sanitizer by accident — the literal-shaped
// `dangerouslySetInnerHTML={{ __html: html }}` form would be a code
// review red flag once this helper exists.
//
// Per-component fidelity tradeoffs (which inline styles are lost and what
// reapplies them at runtime) live in the call sites — see the comment on
// each embed component. The CSP rationale lives in
// packages/shared-csp/strip-inline-styles.ts. This helper just enforces
// the contract at the JSX boundary.
export function safeInnerHTML(html: string): { __html: string } {
  return { __html: stripInlineStyles(html) };
}
