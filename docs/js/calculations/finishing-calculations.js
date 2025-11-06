import { clampToZero, inchesToMillimeters } from '../utils/units.js';

export function generateEdgePositions(startOffset, docSpan, gutterSpan, docCount) {
  if (docCount <= 0) return [];
  const out = [];
  const g = clampToZero(gutterSpan);
  let lead = startOffset;
  out.push(lead);
  for (let i = 0; i < docCount; i++) {
    const trail = lead + docSpan;
    out.push(trail);
    if (i < docCount - 1) {
      lead = trail + g;
      if (g > 0) out.push(lead);
    }
  }
  return out;
}

export function generateScorePositions(startOffset, docSpan, gutterSpan, docCount, offsets) {
  const raw = Array.isArray(offsets) ? offsets : [];
  const offs = raw
    .filter((x) => Number.isFinite(Number(x)))
    .map((x) => Math.min(Math.max(Number(x) || 0, 0), 1));
  if (offs.length === 0) return [];
  const g = clampToZero(gutterSpan);
  const out = [];
  for (let i = 0; i < docCount; i++) {
    const s = startOffset + i * (docSpan + g);
    offs.forEach((o) => out.push(s + docSpan * o));
  }
  return out;
}

export const mapPositionsToReadout = (label, positions) =>
  positions.map((p, i) => ({
    label: `${label} ${i + 1}`,
    inches: Number(p.toFixed(3)),
    millimeters: inchesToMillimeters(p),
  }));

export function calculateFinishing(layout, options = {}) {
  const { layoutArea, counts, document, gutter } = layout;
  const hEdges = generateEdgePositions(layoutArea.originY, document.height, gutter.vertical, counts.down);
  const vEdges = generateEdgePositions(layoutArea.originX, document.width, gutter.horizontal, counts.across);
  const hScores = generateScorePositions(
    layoutArea.originY,
    document.height,
    gutter.vertical,
    counts.down,
    options.scoreHorizontal
  );
  const vScores = generateScorePositions(
    layoutArea.originX,
    document.width,
    gutter.horizontal,
    counts.across,
    options.scoreVertical
  );
  const hPerforations = generateScorePositions(
    layoutArea.originY,
    document.height,
    gutter.vertical,
    counts.down,
    options.perforationHorizontal
  );
  const vPerforations = generateScorePositions(
    layoutArea.originX,
    document.width,
    gutter.horizontal,
    counts.across,
    options.perforationVertical
  );
  return {
    cuts: mapPositionsToReadout('Cut', hEdges),
    slits: mapPositionsToReadout('Slit', vEdges),
    scores: {
      horizontal: mapPositionsToReadout('Score', hScores),
      vertical: mapPositionsToReadout('Score', vScores),
    },
    perforations: {
      horizontal: mapPositionsToReadout('Perforation', hPerforations),
      vertical: mapPositionsToReadout('Perforation', vPerforations),
    },
  };
}

if (typeof console !== 'undefined') {
  const regressionPositions = generateEdgePositions(0, 1, 0, 2);
  console.assert(
    regressionPositions.length === 3 && new Set(regressionPositions).size === 3,
    'Expected unique cut positions for zero gutter layouts.'
  );
}
