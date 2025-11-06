import { clampToZero, inchesToMillimeters } from './units.js';

const EPSILON = 1e-6;

const toFinite = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const dedupeSorted = (values = []) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.filter((value, index, arr) => {
    if (index === 0) return true;
    return Math.abs(value - arr[index - 1]) > EPSILON;
  });
};

const positionsToSegments = (positions = []) => {
  if (!Array.isArray(positions) || positions.length === 0) return [];
  const normalized = positions
    .map((pos) => clampToZero(toFinite(pos)))
    .filter((pos) => pos > EPSILON);
  if (normalized.length === 0) return [];
  const unique = dedupeSorted(normalized);
  const spans = [];
  let previous = 0;
  unique.forEach((position) => {
    const delta = clampToZero(position - previous);
    if (delta > EPSILON) {
      spans.push(delta);
    }
    previous = position;
  });
  return spans;
};

const buildAxisSegments = ({ leadMargin = 0, docSpan = 0, gutterSpan = 0, count = 0 } = {}) => {
  const docs = Math.max(0, Math.floor(toFinite(count)));
  const docSize = clampToZero(toFinite(docSpan));
  if (docs <= 0 || docSize <= EPSILON) {
    const margin = clampToZero(toFinite(leadMargin));
    return margin > EPSILON ? [margin] : [];
  }
  const gutterSize = clampToZero(toFinite(gutterSpan));
  const margin = clampToZero(toFinite(leadMargin));
  const positions = [];
  let cursor = margin;
  if (cursor > EPSILON) positions.push(cursor);
  for (let i = 0; i < docs; i += 1) {
    cursor += docSize;
    positions.push(cursor);
    if (i < docs - 1 && gutterSize > EPSILON) {
      cursor += gutterSize;
      positions.push(cursor);
    }
  }
  return positionsToSegments(positions);
};

export const calculateProgramSequence = (layout = {}) => {
  if (!layout || typeof layout !== 'object') return [];
  const { realizedMargins = {}, document = {}, gutter = {}, counts = {} } = layout;

  const horizontalSegments = buildAxisSegments({
    leadMargin: realizedMargins.left,
    docSpan: document.width,
    gutterSpan: gutter.horizontal,
    count: counts.across,
  });

  const verticalSegments = buildAxisSegments({
    leadMargin: realizedMargins.top,
    docSpan: document.height,
    gutterSpan: gutter.vertical,
    count: counts.down,
  });

  const rows = [];
  let step = 1;

  const pushRow = (span, axisLabel) => {
    if (!(span > EPSILON)) return;
    const inches = Number(clampToZero(span).toFixed(4));
    rows.push({
      label: axisLabel ? `Step ${step} — ${axisLabel}` : `Step ${step}`,
      inches,
      millimeters: inchesToMillimeters(inches),
    });
    step += 1;
  };

  horizontalSegments.forEach((segment) => pushRow(segment, 'Horizontal'));
  verticalSegments.forEach((segment) => pushRow(segment, 'Vertical'));

  return rows;
};

export default calculateProgramSequence;
