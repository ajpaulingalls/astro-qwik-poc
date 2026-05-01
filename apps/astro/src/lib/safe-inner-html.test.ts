import { describe, it, expect } from 'vitest';
import { safeInnerHTML } from './safe-inner-html';

describe('safeInnerHTML', () => {
  it('returns the JSX __html shape', () => {
    const result = safeInnerHTML('<p>x</p>');
    expect(result).toEqual({ __html: '<p>x</p>' });
  });

  it('strips inline style attributes via stripInlineStyles', () => {
    // Pin the integration: removing the stripInlineStyles call from
    // safe-inner-html.ts would leave the prior test green but reintroduce
    // the CSP violations the audit-deliverable fix prevents.
    const result = safeInnerHTML('<div style="width: 770px">x</div>');
    expect(result).toEqual({ __html: '<div>x</div>' });
  });
});
