import { describe, expect, it } from 'vitest';
import { calculateDocumentCount } from '../docs/js/calculations/layout-calculations.js';

describe('calculateDocumentCount', () => {
  it('treats tiny floating point underflows as full capacity', () => {
    const avail = 10.2755999999999989569;
    const span = 3.34645999999999999019;
    const gutter = 0.118110000000000006648;

    expect(calculateDocumentCount(avail, span, gutter)).toBe(3);
  });

  it('does not round up when the ratio is genuinely below the next integer', () => {
    const span = 3.34646;
    const gutter = 0.11811;
    const avail = 10.1023715; // Equivalent to ~2.95 documents of usable space.

    expect(calculateDocumentCount(avail, span, gutter)).toBe(2);
  });
});
