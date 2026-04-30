// Strips `style="..."` and `style='...'` attributes from arbitrary HTML before
// it lands in dangerouslySetInnerHTML. The Astro CSP at
// packages/shared-csp/index.ts:buildAstroCspConfig does not allow inline-style
// attributes (style-src-attr falls back to default-src 'self'), so any inline
// style="" smuggled in via CMS HTML triggers a securitypolicyviolation event
// at runtime — caught by the perf-harness CSP collector
// (packages/perf-harness/web_vitals_collector.ts).
//
// Sprint-012 story-004 M1 sweep observed 4 violations per Astro article load
// + 1-2 per liveblog load, all from WordPress wp-caption and Brightcove
// embed inline styles. This sanitizer is the audit-deliverable fix.
//
// Scope: only the `style` attribute. <style> blocks are style-src-elem, which
// Astro 6 auto-hashes via the scriptDirective mechanism — they don't violate.
// data-style and similar attributes are left intact (CSP only inspects the
// literal `style` attribute, not anything that contains "style" as a
// substring).
//
// The regex is anchored on a leading-whitespace boundary (`\s+`) before
// `style`, then accepts optional whitespace around `=`, then matches either
// quote style. This intentionally avoids matching `class="style-x"` or
// `data-style="..."` because both lack the leading-whitespace + bare-`style=`
// pattern.
//
// Known limitation — attribute-value smuggling: an attribute value that
// literally contains `style="…"` as a substring (e.g. a server-side
// template stored in `data-tmpl='<x style="y">'`) will have the inner
// `style="y"` stripped. We accept this — the CMS doesn't emit such markup
// today and a full HTML parse would cost ~100x more per SSR pass. Revisit
// if a fixture surfaces it.
export function stripInlineStyles(html: string): string {
  return html.replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
}
