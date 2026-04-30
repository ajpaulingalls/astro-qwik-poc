// document.hidden is a getter on Document.prototype, so tests that exercise
// shouldSkip-style closures by flipping it via Object.defineProperty leave an
// own-property override on document. Without restoration, the override sticks
// for any later test in the same file (and worse, across files if the
// document instance is shared). isolateDocumentHidden() captures the original
// descriptor before each test and restores it after, so flips are scoped.
import { afterEach, beforeEach } from 'vitest';

export function isolateDocumentHidden(): void {
  let original: PropertyDescriptor | undefined;
  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(document, 'hidden');
  });
  afterEach(() => {
    if (original) Object.defineProperty(document, 'hidden', original);
    else delete (document as unknown as { hidden?: boolean }).hidden;
  });
}
