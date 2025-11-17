import { describe, it, expect } from 'vitest';
import { DEFAULT_INPUTS } from '../docs/js/config/defaults.js';
import { createCalculationContext, calculateLayout } from '../docs/js/calculations/layout-calculations.js';
import { inchesToMillimeters } from '../docs/js/utils/units.js';

describe('calculator bootstrap invariants', () => {
  it('converts inches to millimeters using the canonical factor', () => {
    expect(inchesToMillimeters(1)).toBeCloseTo(25.4, 10);
  });

  it('produces at least one document in each direction for default inputs', () => {
    const ctx = createCalculationContext({
      sheet: { ...DEFAULT_INPUTS.sheet },
      document: { ...DEFAULT_INPUTS.document },
      gutter: { ...DEFAULT_INPUTS.gutter },
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      nonPrintable: { ...DEFAULT_INPUTS.nonPrintable },
    });
    const layout = calculateLayout(ctx);

    expect(layout.counts.across).toBeGreaterThanOrEqual(1);
    expect(layout.counts.down).toBeGreaterThanOrEqual(1);
  });
});
