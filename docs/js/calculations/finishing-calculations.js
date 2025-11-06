import { clampToZero, inchesToMillimeters } from '../utils/units.js';

const VALID_HOLE_EDGES = new Set(['top', 'bottom', 'left', 'right']);
const VALID_HOLE_ALIGNS = new Set(['start', 'center', 'end']);

const clampRange = (value, min, max) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  if (min > max) return min;
  return Math.min(Math.max(numeric, min), max);
};

const normalizeHoleEntry = (entry = {}) => {
  const edge = VALID_HOLE_EDGES.has(entry.edge) ? entry.edge : 'left';
  const align = VALID_HOLE_ALIGNS.has(entry.align) ? entry.align : 'center';
  const axisOffset = Number(entry.axisOffset);
  const offset = Number(entry.offset);
  return {
    edge,
    align,
    axisOffset: Number.isFinite(axisOffset) ? axisOffset : 0,
    offset: Math.max(0, Number.isFinite(offset) ? offset : 0),
  };
};

const resolveAxisCoordinate = (span, align, axisOffset = 0) => {
  const length = Math.max(0, Number(span) || 0);
  if (length === 0) return 0;
  const cleanOffset = Number.isFinite(axisOffset) ? axisOffset : 0;
  if (align === 'start') {
    return clampRange(Math.max(0, cleanOffset), 0, length);
  }
  if (align === 'end') {
    return clampRange(length - Math.max(0, cleanOffset), 0, length);
  }
  if (align === 'center') {
    return clampRange(length / 2 + cleanOffset, 0, length);
  }
  return clampRange(length / 2, 0, length);
};

const mapHoleEntryToDocument = (entry, document) => {
  if (!document || typeof document.width !== 'number' || typeof document.height !== 'number') {
    return null;
  }
  const normalized = normalizeHoleEntry(entry);
  const width = Math.max(0, document.width);
  const height = Math.max(0, document.height);
  if (width === 0 || height === 0) return null;

  switch (normalized.edge) {
    case 'top':
      return {
        x: resolveAxisCoordinate(width, normalized.align, normalized.axisOffset),
        y: clampRange(normalized.offset, 0, height),
      };
    case 'bottom':
      return {
        x: resolveAxisCoordinate(width, normalized.align, normalized.axisOffset),
        y: clampRange(height - Math.max(0, normalized.offset), 0, height),
      };
    case 'left':
      return {
        x: clampRange(normalized.offset, 0, width),
        y: resolveAxisCoordinate(height, normalized.align, normalized.axisOffset),
      };
    case 'right':
      return {
        x: clampRange(width - Math.max(0, normalized.offset), 0, width),
        y: resolveAxisCoordinate(height, normalized.align, normalized.axisOffset),
      };
    default:
      return null;
  }
};

const generateHolePositions = (layout, plan = {}) => {
  const entries = Array.isArray(plan.entries) ? plan.entries.map(normalizeHoleEntry) : [];
  const diameter = Number(plan.size);
  const cleanDiameter = Number.isFinite(diameter) && diameter > 0 ? diameter : 0;
  if (entries.length === 0 || cleanDiameter <= 0) {
    return [];
  }

  const countsAcross = Math.max(0, layout?.counts?.across ?? 0);
  const countsDown = Math.max(0, layout?.counts?.down ?? 0);
  if (countsAcross === 0 || countsDown === 0) {
    return [];
  }

  const layoutArea = layout.layoutArea ?? {};
  const gutter = layout.gutter ?? { horizontal: 0, vertical: 0 };
  const document = layout.document ?? {};
  const horizontalStep = (document.width ?? 0) + clampToZero(gutter.horizontal ?? 0);
  const verticalStep = (document.height ?? 0) + clampToZero(gutter.vertical ?? 0);

  const holes = [];

  for (let row = 0; row < countsDown; row++) {
    for (let col = 0; col < countsAcross; col++) {
      const originX = (layoutArea.originX ?? 0) + col * horizontalStep;
      const originY = (layoutArea.originY ?? 0) + row * verticalStep;
      entries.forEach((entry, index) => {
        const position = mapHoleEntryToDocument(entry, document);
        if (!position) return;
        holes.push({
          label: `Hole ${index + 1} — Doc ${col + 1},${row + 1}`,
          x: originX + position.x,
          y: originY + position.y,
          diameter: cleanDiameter,
          docAcross: col + 1,
          docDown: row + 1,
          holeIndex: index + 1,
        });
      });
    }
  }

  return holes;
};

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
  const holes = generateHolePositions(layout, options.holePlan);
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
    holes,
  };
}

if (typeof console !== 'undefined') {
  const regressionPositions = generateEdgePositions(0, 1, 0, 2);
  console.assert(
    regressionPositions.length === 3 && new Set(regressionPositions).size === 3,
    'Expected unique cut positions for zero gutter layouts.'
  );
}
