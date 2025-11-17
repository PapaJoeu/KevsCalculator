import { describe, it, expect } from 'vitest';
import {
  generateEdgePositions,
  generateScorePositions,
  mapPositionsToReadout,
  calculateFinishing,
} from '../docs/js/calculations/finishing-calculations.js';

const mm = (inches, precision = 2) => Number((inches * 25.4).toFixed(precision));

describe('finishing calculations integration', () => {
  it('produces mapped cut, slit, score, and perforation readouts for a representative layout', () => {
    const layout = {
      layoutArea: { originX: 0.25, originY: 0.5 },
      counts: { across: 3, down: 2 },
      document: { width: 3.5, height: 2 },
      gutter: { horizontal: 0.125, vertical: 0.25 },
    };

    const options = {
      scoreHorizontal: [0.25, 0.75],
      scoreVertical: [0.5],
      perforationHorizontal: [0.5],
      perforationVertical: [0.25, 0.75],
    };

    const result = calculateFinishing(layout, options);

    const expectedCuts = [0.5, 2.5, 2.75, 4.75];
    const expectedSlits = [0.25, 3.75, 3.875, 7.375, 7.5, 11];
    const expectedHorizontalScores = [1, 2, 3.25, 4.25];
    const expectedVerticalScores = [2, 5.625, 9.25];
    const expectedHorizontalPerfs = [1.5, 3.75];
    const expectedVerticalPerfs = [1.125, 2.875, 4.75, 6.5, 8.375, 10.125];

    expect(result.cuts).toEqual(
      expectedCuts.map((value, index) => ({
        label: `Cut ${index + 1}`,
        inches: Number(value.toFixed(3)),
        millimeters: mm(value),
      }))
    );

    expect(result.slits).toEqual(
      expectedSlits.map((value, index) => ({
        label: `Slit ${index + 1}`,
        inches: Number(value.toFixed(3)),
        millimeters: mm(value),
      }))
    );

    expect(result.scores.horizontal).toEqual(
      expectedHorizontalScores.map((value, index) => ({
        label: `Score ${index + 1}`,
        inches: Number(value.toFixed(3)),
        millimeters: mm(value),
      }))
    );

    expect(result.scores.vertical).toEqual(
      expectedVerticalScores.map((value, index) => ({
        label: `Score ${index + 1}`,
        inches: Number(value.toFixed(3)),
        millimeters: mm(value),
      }))
    );

    expect(result.perforations.horizontal).toEqual(
      expectedHorizontalPerfs.map((value, index) => ({
        label: `Perforation ${index + 1}`,
        inches: Number(value.toFixed(3)),
        millimeters: mm(value),
      }))
    );

    expect(result.perforations.vertical).toEqual(
      expectedVerticalPerfs.map((value, index) => ({
        label: `Perforation ${index + 1}`,
        inches: Number(value.toFixed(3)),
        millimeters: mm(value),
      }))
    );

    expect(result.holes).toEqual([]);

    const readouts = [
      ...result.cuts,
      ...result.slits,
      ...result.scores.horizontal,
      ...result.scores.vertical,
      ...result.perforations.horizontal,
      ...result.perforations.vertical,
    ];

    readouts.forEach(({ inches, millimeters }) => {
      expect(millimeters).toBe(mm(inches));
    });
  });
});

describe('hole drilling generation', () => {
  it('produces hole centers for each document using edge alignment and offsets', () => {
    const layout = {
      layoutArea: { originX: 1, originY: 2 },
      counts: { across: 2, down: 2 },
      document: { width: 4, height: 6 },
      gutter: { horizontal: 1, vertical: 2 },
    };

    const holePlan = {
      size: 0.25,
      entries: [
        { edge: 'left', align: 'start', axisOffset: 0.5, offset: 0.3125 },
        { edge: 'left', align: 'center', axisOffset: 0, offset: 0.3125 },
        { edge: 'left', align: 'end', axisOffset: 0.5, offset: 0.3125 },
      ],
    };

    const result = calculateFinishing(layout, { holePlan });

    expect(result.holes).toHaveLength(12);

    const expectedFirstDoc = [
      { label: 'Hole 1 — Doc 1,1', x: 1.3125, y: 2.5, diameter: 0.25 },
      { label: 'Hole 2 — Doc 1,1', x: 1.3125, y: 5, diameter: 0.25 },
      { label: 'Hole 3 — Doc 1,1', x: 1.3125, y: 7.5, diameter: 0.25 },
    ];

    expect(result.holes.slice(0, 3)).toMatchObject(expectedFirstDoc);

    const expectedSecondRowFirstDoc = { label: 'Hole 1 — Doc 1,2', x: 1.3125, y: 10.5, diameter: 0.25 };
    expect(result.holes[6]).toMatchObject(expectedSecondRowFirstDoc);
  });
});

describe('calculateFinishing layout resilience', () => {
  it('returns empty measurement collections when layout is omitted', () => {
    const result = calculateFinishing(undefined, {
      scoreHorizontal: [0.5],
      scoreVertical: [0.5],
      perforationHorizontal: [0.25],
      perforationVertical: [0.25],
    });

    expect(result).toEqual({
      cuts: [],
      slits: [],
      scores: { horizontal: [], vertical: [] },
      perforations: { horizontal: [], vertical: [] },
      holes: [],
    });
  });

  it('falls back to defaults when only partial layout data is provided', () => {
    const layout = {
      layoutArea: { originX: 1 },
      counts: { across: 2 },
      document: { width: 4 },
    };

    const result = calculateFinishing(layout, {
      scoreVertical: [0.5],
      perforationVertical: [0.25],
    });

    expect(result.cuts).toEqual([]);
    expect(result.scores.horizontal).toEqual([]);
    expect(result.perforations.horizontal).toEqual([]);

    const expectedSlits = [1, 5, 9];
    expect(result.slits).toEqual(
      expectedSlits.map((value, index) => ({
        label: `Slit ${index + 1}`,
        inches: Number(value.toFixed(3)),
        millimeters: mm(value),
      }))
    );

    const expectedVerticalScores = [3, 7];
    expect(result.scores.vertical).toEqual(
      expectedVerticalScores.map((value, index) => ({
        label: `Score ${index + 1}`,
        inches: Number(value.toFixed(3)),
        millimeters: mm(value),
      }))
    );

    const expectedVerticalPerforations = [2, 6];
    expect(result.perforations.vertical).toEqual(
      expectedVerticalPerforations.map((value, index) => ({
        label: `Perforation ${index + 1}`,
        inches: Number(value.toFixed(3)),
        millimeters: mm(value),
      }))
    );

    expect(result.holes).toEqual([]);
  });
});

describe('finishing calculation helpers edge cases', () => {
  it('returns empty arrays for zero documents', () => {
    expect(generateEdgePositions(0, 2, 0.5, 0)).toEqual([]);
    expect(generateScorePositions(0, 2, 0.5, 0, [0.5])).toEqual([]);

    const layout = {
      layoutArea: { originX: 0, originY: 0 },
      counts: { across: 0, down: 0 },
      document: { width: 3, height: 2 },
      gutter: { horizontal: 0, vertical: 0 },
    };

    const result = calculateFinishing(layout, {
      scoreHorizontal: [0.5],
      scoreVertical: [0.5],
    });

    expect(result.cuts).toEqual([]);
    expect(result.slits).toEqual([]);
    expect(result.scores.horizontal).toEqual([]);
    expect(result.scores.vertical).toEqual([]);
    expect(result.perforations.horizontal).toEqual([]);
    expect(result.perforations.vertical).toEqual([]);
  });

  it('sanitizes offsets for score generation', () => {
    const sanitized = generateScorePositions(1, 2, 0.5, 2, [
      -1,
      0,
      0.2,
      '0.8',
      'invalid',
      1.2,
      null,
    ]);

    expect(sanitized).toEqual([1, 1, 1.4, 2.6, 3, 1, 3.5, 3.5, 3.9, 5.1, 5.5, 3.5]);
  });

  it('avoids duplicate cut positions for zero-gutter layouts', () => {
    const zeroGutterEdges = generateEdgePositions(0, 1, 0, 2);
    expect(new Set(zeroGutterEdges).size).toBe(zeroGutterEdges.length);

    const readout = mapPositionsToReadout('Cut', zeroGutterEdges);
    readout.forEach(({ inches, millimeters }) => {
      expect(millimeters).toBe(mm(inches));
    });
  });
});

describe('mapPositionsToReadout precision controls', () => {
  it('rounds millimeters once to keep preview and print aligned', () => {
    const value = 0.123456;
    const [entry] = mapPositionsToReadout('Cut', [value]);
    expect(entry.millimeters).toBe(mm(value));
  });

  it('honors custom precision overrides', () => {
    const value = 1 / 3;
    const precision = { inches: 4, millimeters: 3 };
    const [entry] = mapPositionsToReadout('Cut', [value], precision);
    expect(entry.inches).toBe(Number(value.toFixed(precision.inches)));
    expect(entry.millimeters).toBe(mm(value, precision.millimeters));
  });
});
