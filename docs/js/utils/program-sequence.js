import { clampToZero, inchesToMillimeters } from './units.js';

// Utility: convert any value to a finite number or fall back to zero.
// Accepts strings, numbers, or undefined. Any non-numeric value becomes 0 so
// downstream math never receives NaN or Infinity.
const toFinite = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// Utility: iterate through candidate values and return the first finite number.
// This mirrors how the historical code would fall back from realized margins to
// configured margins (and vice versa) until it found a usable value.
const pickFinite = (...values) => {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
};

// Recreate the legacy layout calculation. This function accepts a deeply nested
// layout object (matching the modern UI schema) and extracts sanitized values
// for the sheet, document, gutter, and margin dimensions. It mirrors the math
// used by the classic scoring tool so that the resulting cut sequence matches
// historic expectations.
const calculateLayoutDetails = (layout = {}) => {
  // The caller may pass null or a partial object; protect against non-objects
  // so we can return a safe fallback immediately.
  if (!layout || typeof layout !== 'object') {
    return null;
  }

  // Sheet dimensions represent the total stock size. In the legacy flow these
  // values were stored under `sheet.rawWidth`/`rawHeight`; they can also be
  // user-supplied strings, so we normalize everything through `toFinite` and
  // clamp negatives to zero.
  const sheetWidth = clampToZero(toFinite(layout.sheet?.rawWidth));
  const sheetLength = clampToZero(toFinite(layout.sheet?.rawHeight));

  // Document dimensions capture the artwork rectangle that needs to be imposed
  // across the sheet. As with sheets, we sanitize each value to guarantee
  // predictable arithmetic downstream.
  const docWidth = clampToZero(toFinite(layout.document?.width));
  const docLength = clampToZero(toFinite(layout.document?.height));

  // Gutters are the spacing between adjacent documents. They may be omitted in
  // the layout, so the sanitization step keeps the numbers safe for math.
  const gutterWidth = clampToZero(toFinite(layout.gutter?.horizontal));
  const gutterLength = clampToZero(toFinite(layout.gutter?.vertical));

  // Margins can originate from manual overrides (`margins`) or the realized
  // layout (`realizedMargins`). We reproduce the original priority by scanning
  // for the first finite number with `pickFinite`.
  const marginWidth = clampToZero(
    pickFinite(layout.margins?.left, layout.realizedMargins?.left),
  );

  const marginLength = clampToZero(
    pickFinite(layout.margins?.top, layout.realizedMargins?.top),
  );

  // `usable` dimensions represent the area of the sheet that can be filled with
  // documents after the outer margins are removed. Negative numbers are clamped
  // so a margin larger than the sheet still produces zero instead of flipping
  // the sign.
  const usableSheetWidth = clampToZero(sheetWidth - 2 * marginWidth);
  const usableSheetLength = clampToZero(sheetLength - 2 * marginLength);

  // Users can specify how many documents they want across/down. Historically we
  // trusted the UI-provided counts when they were positive integers, otherwise
  // we fell back to a sheet-based calculation. These helpers reproduce that
  // behavior while protecting against fractional inputs.
  const docsAcrossFromLayout = Math.max(0, Math.floor(toFinite(layout.counts?.across)));
  const docsDownFromLayout = Math.max(0, Math.floor(toFinite(layout.counts?.down)));

  // Pre-compute the stepping distance (document + gutter) along each axis.
  const horizontalStep = docWidth + gutterWidth;
  const verticalStep = docLength + gutterLength;

  // Compute how many documents *could* fit on the sheet if we ignore the user
  // overrides. This mirrors the legacy algorithm's search for the first integer
  // fit along each dimension.
  const docsAcrossFromSheet = docWidth > 0 && horizontalStep > 0
    ? Math.max(0, Math.floor(usableSheetWidth / horizontalStep))
    : 0;
  const docsDownFromSheet = docLength > 0 && verticalStep > 0
    ? Math.max(0, Math.floor(usableSheetLength / verticalStep))
    : 0;

  // Choose the final document counts by favoring the explicit layout entries
  // (if they are positive) and falling back to the sheet-based counts. This
  // function mirrors the historical `resolveCount` helper from the old code.
  const resolveCount = (primary, fallback) => {
    const p = Math.max(0, primary);
    if (p > 0) return p;
    const f = Math.max(0, fallback);
    return f > 0 ? f : 0;
  };

  const safeDocsAcross = resolveCount(docsAcrossFromLayout, docsAcrossFromSheet);
  const safeDocsDown = resolveCount(docsDownFromLayout, docsDownFromSheet);

  // Translate document counts into the total occupied space. This gives us the
  // span of the documents plus the gutters, which we use for both the cutting
  // sequence and to locate the layout within the sheet.
  const totalGutterWidth = Math.max(0, safeDocsAcross - 1) * gutterWidth;
  const totalGutterLength = Math.max(0, safeDocsDown - 1) * gutterLength;
  const imposedSpaceWidth = safeDocsAcross * docWidth + totalGutterWidth;
  const imposedSpaceLength = safeDocsDown * docLength + totalGutterLength;

  // Compute the leftover margins between the imposed area and the sheet edges.
  // The legacy implementation centered the documents on the sheet, so we split
  // the remainder evenly across both sides (hence the division by two).
  const topMargin = (sheetLength - imposedSpaceLength) / 2;
  const leftMargin = (sheetWidth - imposedSpaceWidth) / 2;

  // Package all derived values. The program sequence builder consumes this
  // object verbatim to keep parity with the historic logic.
  return {
    sheetWidth,
    sheetLength,
    usableSheetWidth,
    usableSheetLength,
    docWidth,
    docLength,
    gutterWidth,
    gutterLength,
    marginWidth,
    marginLength,
    docsAcross: safeDocsAcross,
    docsDown: safeDocsDown,
    imposedSpaceWidth,
    imposedSpaceLength,
    topMargin: clampToZero(topMargin),
    leftMargin: clampToZero(leftMargin),
    gutterSpaceWidth: totalGutterWidth,
    gutterSpaceLength: totalGutterLength,
  };
};

// Append the interior cut locations to the sequence. This mirrors the original
// imperative helper that handled two separate responsibilities:
//   1. Add the progressive "step back" cuts that separate adjacent documents.
//   2. If gutters exist, add the smaller "back cuts" that trim the gutters.
// Every input goes through the same sanitization pipeline so we never push
// invalid numbers onto the sequence.
const appendCuts = (sequence, count, size, gutter, imposedSize) => {
  const safeCount = Math.max(0, Math.floor(toFinite(count)));
  const safeSize = clampToZero(toFinite(size));
  const safeGutter = clampToZero(toFinite(gutter));
  const safeImposed = clampToZero(toFinite(imposedSize));

  // Internal cuts: starting from the imposed edge, walk backward by the size of
  // a document plus its gutter to determine each cut location. We stop one
  // document early because a single document requires no internal cuts.
  for (let i = 1; i < safeCount; i += 1) {
    sequence.push(clampToZero(safeImposed - i * (safeSize + safeGutter)));
  }

  // Back cuts: if gutters exist we need to add the smaller cuts that remove the
  // gutter material. The old algorithm simply appended the document size for
  // each break, which downstream tooling interpreted as back cuts.
  if (safeGutter > 0) {
    for (let i = 1; i < safeCount; i += 1) {
      sequence.push(safeSize);
    }
  }
};

// Primary export: convert a complex layout configuration into a step-by-step
// cutting program. This entry point mirrors the legacy `calculateSequence` API
// and produces the same labeled rows consumed by the UI.
export const calculateProgramSequence = (layout = {}) => {
  // Derive all sanitized dimensions first. If the layout is invalid, bail out
  // with an empty sequence so the UI renders nothing instead of crashing.
  const details = calculateLayoutDetails(layout);
  if (!details) return [];

  // Start a fresh sequence and push the outer perimeter cuts. Historically the
  // first four values always represented the sheet edges (top, side) followed
  // by the imposed area dimensions.
  const sequence = [];

  sequence.push(clampToZero(details.sheetLength - details.topMargin));
  sequence.push(clampToZero(details.sheetWidth - details.leftMargin));
  sequence.push(clampToZero(details.imposedSpaceLength));
  sequence.push(clampToZero(details.imposedSpaceWidth));

  // Add horizontal (across) cuts and any associated back cuts.
  appendCuts(
    sequence,
    details.docsAcross,
    details.docWidth,
    details.gutterWidth,
    details.imposedSpaceWidth,
  );

  // Add vertical (down) cuts and any associated back cuts.
  appendCuts(
    sequence,
    details.docsDown,
    details.docLength,
    details.gutterLength,
    details.imposedSpaceLength,
  );

  // The legacy flow required all values to be positive numbers in both inches
  // and millimeters. This final pass sanitizes the raw sequence, strips out
  // zero/negative entries, rounds to four decimal places (matching the classic
  // UI), and labels each step for display.
  return sequence
    .map((value) => clampToZero(toFinite(value)))
    .filter((value) => value > 0)
    .map((value, index) => {
      const inches = Number(value.toFixed(4));
      return {
        label: `Step ${index + 1}`,
        inches,
        millimeters: inchesToMillimeters(inches),
      };
    });
};

export default calculateProgramSequence;
