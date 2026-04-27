// Tiny heading-by-role helper for Qwik card tests. Catches `h3` → `div`
// regressions that `screen.querySelector('h3')?.textContent.toContain(...)`
// silently misses (a div with the same text passes both assertions).
//
// We can't use @testing-library/dom's getByRole on Qwik's createDOM screen:
// dom-accessibility-api needs window.getComputedStyle, but Qwik 2 beta.32's
// bundled DOM doesn't expose it. Qwik's renderToString also crashes inside
// vitest (Symbol(backRef) getter error in beta.32). This bypass keeps the
// test value (heading-tag mutation detection) without the dep + incompat.
//
// Revisit when Qwik 2 stable ships — testing-library compat may land then.
type Screen = { querySelectorAll: (selector: string) => NodeListOf<Element> };

function findHeading(
  screen: Screen,
  level: 1 | 2 | 3 | 4 | 5 | 6,
  name: string | RegExp,
): { match: HTMLElement | null; headings: Element[] } {
  const headings = Array.from(screen.querySelectorAll(`h${level}`));
  const matches = (text: string) =>
    typeof name === 'string' ? text.includes(name) : name.test(text);
  const match = (headings.find((el) => matches(el.textContent ?? '')) ??
    null) as HTMLElement | null;
  return { match, headings };
}

export function getByHeading(
  screen: Screen,
  level: 1 | 2 | 3 | 4 | 5 | 6,
  name: string | RegExp,
): HTMLElement {
  const { match, headings } = findHeading(screen, level, name);
  if (!match) {
    const seen = headings.map((el) => el.textContent).join(', ');
    throw new Error(`getByHeading: no <h${level}> matching ${name}; saw [${seen}]`);
  }
  return match;
}

// Sibling to getByHeading: getBy throws on miss (assertion); queryBy returns
// null (existence check) — sharper than `querySelectorAll(...).length === 0`,
// which silently passes when the selector itself is wrong.
export function queryByHeading(
  screen: Screen,
  level: 1 | 2 | 3 | 4 | 5 | 6,
  name: string | RegExp,
): HTMLElement | null {
  return findHeading(screen, level, name).match;
}
