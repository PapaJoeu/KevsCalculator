import { describe, expect, it } from 'vitest';
import { DEFAULT_INPUTS } from '../docs/js/config/defaults.js';
import {
  createCalculationContext,
  calculateLayout,
  applyCountOverrides,
} from '../docs/js/calculations/layout-calculations.js';
import { calculateFinishing } from '../docs/js/calculations/finishing-calculations.js';
import { MM_PER_INCH } from '../docs/js/utils/units.js';

const defaultFinishingOptions = {
  scoreHorizontal: [0.5],
  scoreVertical: [0.5],
  perforationHorizontal: [0.25],
  perforationVertical: [0.25, 0.75],
};

const convertMeasurement = (value, units) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return units === 'mm' ? numeric / MM_PER_INCH : numeric;
};

const convertRect = (rect, keys, units) => {
  if (!rect) return undefined;
  return keys.reduce((acc, key) => {
    acc[key] = convertMeasurement(rect[key], units);
    return acc;
  }, {});
};

const normalizeInputs = (inputs) => {
  const units = inputs.units ?? 'in';
  return {
    sheet: convertRect(inputs.sheet, ['width', 'height'], units),
    document: convertRect(inputs.document, ['width', 'height'], units),
    gutter: convertRect(inputs.gutter, ['horizontal', 'vertical'], units),
    margins: convertRect(inputs.margins, ['top', 'right', 'bottom', 'left'], units),
    nonPrintable: convertRect(inputs.nonPrintable, ['top', 'right', 'bottom', 'left'], units),
  };
};

const runPipeline = (rawInputs, { finishingOptions = defaultFinishingOptions, forceAcross, forceDown } = {}) => {
  const normalizedInputs = normalizeInputs(rawInputs);
  const context = createCalculationContext(normalizedInputs);
  const layout = applyCountOverrides(calculateLayout(context), forceAcross, forceDown);
  const finishing = calculateFinishing(layout, finishingOptions);
  return { context, layout, finishing };
};

const mapReadoutToInches = (readout) => readout.map((entry) => entry.inches);

const convertInputsToMillimeters = (inputs) => ({
  units: 'mm',
  sheet: {
    width: inputs.sheet.width * MM_PER_INCH,
    height: inputs.sheet.height * MM_PER_INCH,
  },
  document: {
    width: inputs.document.width * MM_PER_INCH,
    height: inputs.document.height * MM_PER_INCH,
  },
  gutter: {
    horizontal: inputs.gutter.horizontal * MM_PER_INCH,
    vertical: inputs.gutter.vertical * MM_PER_INCH,
  },
  nonPrintable: {
    top: inputs.nonPrintable.top * MM_PER_INCH,
    right: inputs.nonPrintable.right * MM_PER_INCH,
    bottom: inputs.nonPrintable.bottom * MM_PER_INCH,
    left: inputs.nonPrintable.left * MM_PER_INCH,
  },
});

describe('layout and finishing integration', () => {
  it('runs the default pipeline and snapshots layout + finishing highlights', () => {
    const { layout, finishing } = runPipeline(DEFAULT_INPUTS);
    const snapshot = {
      counts: layout.counts,
      trailingMargins: {
        horizontal: layout.usage.horizontal.trailingMargin,
        vertical: layout.usage.vertical.trailingMargin,
      },
      cuts: mapReadoutToInches(finishing.cuts),
      slits: mapReadoutToInches(finishing.slits),
    };

    expect(snapshot).toMatchInlineSnapshot(`
      {
        "counts": {
          "across": 3,
          "down": 8,
        },
        "cuts": [
          0.063,
          2.063,
          2.188,
          4.188,
          4.313,
          6.313,
          6.438,
          8.438,
          8.563,
          10.563,
          10.688,
          12.688,
          12.813,
          14.813,
          14.938,
          16.938,
        ],
        "slits": [
          0.063,
          3.563,
          3.688,
          7.188,
          7.313,
          10.813,
        ],
        "trailingMargins": {
          "horizontal": 1.125,
          "vertical": 1,
        },
      }
    `);
  });

  it('reduces across capacity and vertical slits when document width grows', () => {
    const baseline = runPipeline(DEFAULT_INPUTS);
    const widerDocument = {
      ...DEFAULT_INPUTS,
      document: { ...DEFAULT_INPUTS.document, width: DEFAULT_INPUTS.document.width + 0.5 },
    };
    const wider = runPipeline(widerDocument);

    expect(wider.layout.counts.across).toBeLessThan(baseline.layout.counts.across);
    expect(mapReadoutToInches(wider.finishing.slits).length).toBeLessThan(
      mapReadoutToInches(baseline.finishing.slits).length,
    );
    expect(wider.layout.usage.horizontal.trailingMargin).toBeGreaterThan(
      baseline.layout.usage.horizontal.trailingMargin,
    );
  });

  it('consumes more vertical space when the gutter increases', () => {
    const baseline = runPipeline(DEFAULT_INPUTS);
    const largerVerticalGutter = {
      ...DEFAULT_INPUTS,
      gutter: { ...DEFAULT_INPUTS.gutter, vertical: DEFAULT_INPUTS.gutter.vertical + 0.375 },
    };
    const updated = runPipeline(largerVerticalGutter);

    expect(updated.layout.counts.down).toBeLessThanOrEqual(baseline.layout.counts.down);
    expect(updated.layout.usage.vertical.trailingMargin).toBeLessThan(
      baseline.layout.usage.vertical.trailingMargin,
    );
    expect(updated.finishing.cuts.length).toBeLessThan(baseline.finishing.cuts.length);
  });

  it('applies forced counts before finishing and trims the readout', () => {
    const baseline = runPipeline(DEFAULT_INPUTS);
    const forced = runPipeline(DEFAULT_INPUTS, { forceAcross: 2, forceDown: 3 });

    expect(forced.layout.counts).toEqual({ across: 2, down: 3 });
    expect(forced.finishing.cuts.length).toBeLessThan(baseline.finishing.cuts.length);
    expect(forced.finishing.slits.length).toBeLessThan(baseline.finishing.slits.length);
  });

  it('recalculates consistently when the same inputs are expressed in millimeters', () => {
    const baseline = runPipeline(DEFAULT_INPUTS);
    const millimeterInputs = convertInputsToMillimeters(DEFAULT_INPUTS);
    const millimeterResult = runPipeline(millimeterInputs);

    expect(millimeterResult.layout.counts).toEqual(baseline.layout.counts);
    expect(millimeterResult.layout.usage.horizontal.usedSpan).toBeCloseTo(
      baseline.layout.usage.horizontal.usedSpan,
    );
    expect(millimeterResult.layout.usage.vertical.usedSpan).toBeCloseTo(
      baseline.layout.usage.vertical.usedSpan,
    );
    expect(mapReadoutToInches(millimeterResult.finishing.cuts)).toEqual(
      mapReadoutToInches(baseline.finishing.cuts),
    );
    expect(mapReadoutToInches(millimeterResult.finishing.slits)).toEqual(
      mapReadoutToInches(baseline.finishing.slits),
    );
  });
});
