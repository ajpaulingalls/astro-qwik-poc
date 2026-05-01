import { describe, it, expect } from 'vitest';
import { stripInlineStyles } from './strip-inline-styles.ts';

describe('stripInlineStyles', () => {
  it('strips a single double-quoted style attribute', () => {
    expect(stripInlineStyles('<div style="width: 770px">x</div>')).toBe('<div>x</div>');
  });

  it('strips a single single-quoted style attribute', () => {
    expect(stripInlineStyles("<div style='width: 770px'>x</div>")).toBe('<div>x</div>');
  });

  it('strips multiple style attributes across the document', () => {
    const input =
      '<div style="display:block"><img src="x.png" style="width: 100px"><span style="color: red">';
    expect(stripInlineStyles(input)).toBe('<div><img src="x.png"><span>');
  });

  it('strips style with extra whitespace around the equals sign', () => {
    expect(stripInlineStyles('<div style = "x">y</div>')).toBe('<div>y</div>');
  });

  it('strips an empty style attribute', () => {
    expect(stripInlineStyles('<div style="">x</div>')).toBe('<div>x</div>');
  });

  it('preserves attributes with "style" as substring (e.g. class="style-x")', () => {
    expect(stripInlineStyles('<div class="my-style style-x">y</div>')).toBe(
      '<div class="my-style style-x">y</div>',
    );
  });

  it('preserves data-style attributes', () => {
    // data-style isn't blocked by CSP — only the literal `style` attribute is.
    expect(stripInlineStyles('<div data-style="x">y</div>')).toBe('<div data-style="x">y</div>');
  });

  it('preserves <style> blocks (those are style-src-elem, hashed by Astro)', () => {
    const input = '<style>.foo { color: red; }</style><div style="x">y</div>';
    expect(stripInlineStyles(input)).toBe('<style>.foo { color: red; }</style><div>y</div>');
  });

  it('returns input unchanged when no inline styles present', () => {
    const html = '<div class="foo"><p>hello</p></div>';
    expect(stripInlineStyles(html)).toBe(html);
  });

  it('handles the WordPress wp-caption pattern from CMS fixtures', () => {
    const input =
      '<div style="width: 770px" class="wp-caption aligncenter"><img src="x.jpg"></div>';
    expect(stripInlineStyles(input)).toBe(
      '<div class="wp-caption aligncenter"><img src="x.jpg"></div>',
    );
  });

  it('handles the Brightcove container pattern (multi-property style)', () => {
    const input =
      '<div style="display: block; position: relative; min-width: 0px; max-width: 770px;">x</div>';
    expect(stripInlineStyles(input)).toBe('<div>x</div>');
  });

  it('strips uppercase STYLE attribute (regex is case-insensitive)', () => {
    // HTML attribute names are case-insensitive. Pin the regex /gi flag.
    expect(stripInlineStyles('<div STYLE="x">y</div>')).toBe('<div>y</div>');
    expect(stripInlineStyles('<div Style="x">y</div>')).toBe('<div>y</div>');
  });

  it('preserves trailing slash on self-closing tags', () => {
    // <img style="x"/> must become <img/>, not <img />. The trailing slash
    // is part of the tag, not the attribute, so the regex must not eat it.
    expect(stripInlineStyles('<img style="width: 100px"/>')).toBe('<img/>');
    expect(stripInlineStyles('<img style="x" src="y"/>')).toBe('<img src="y"/>');
  });

  // The two tests below pin the *current* limits called out in the JSDoc
  // "Known limits" block. They document, not endorse — if a future refactor
  // closes either gap (e.g. by switching to a real HTML parser), update the
  // JSDoc and flip the assertion. They exist so the limit can never be
  // silently broken or silently fixed without a visible test diff.
  it('LIMIT: unquoted attribute values are NOT stripped (HTML5 bare-word form)', () => {
    // The regex requires "..." or '...' around the value, so HTML5 bare-word
    // attributes slip through. WordPress fixtures use quoted forms; the next
    // perf-sweep CSP collector would catch any CMS that emitted this.
    expect(stripInlineStyles('<div style=red>y</div>')).toBe('<div style=red>y</div>');
  });

  it('LIMIT: a quoted style="..." substring inside another attribute IS stripped', () => {
    // Attribute-value smuggling: a server-side template stored in another
    // attribute that literally contains `style="..."` will be mangled. CMS
    // doesn't emit such markup today.
    expect(stripInlineStyles('<div data-tmpl=\'<x style="y">\'>z</div>')).toBe(
      "<div data-tmpl='<x>'>z</div>",
    );
  });
});
