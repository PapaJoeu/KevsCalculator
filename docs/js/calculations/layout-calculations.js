import { clampToZero, toNumber } from '../utils/units.js';

export const normalizePerSide = (s = {}) => ({
  top: toNumber(s.top),
  right: toNumber(s.right),
  bottom: toNumber(s.bottom),
  left: toNumber(s.left),
});

export function createCalculationContext({ sheet, document, gutter, margins = {}, nonPrintable = {} }) {
  const m = normalizePerSide(margins);
  const np = normalizePerSide(nonPrintable);
  const sw = toNumber(sheet?.width),
    sh = toNumber(sheet?.height);
  const dw = toNumber(document?.width),
    dh = toNumber(document?.height);
  const gh = toNumber(gutter?.horizontal),
    gv = toNumber(gutter?.vertical);
  const effW = clampToZero(sw - np.left - np.right);
  const effH = clampToZero(sh - np.top - np.bottom);

  const originX = Math.max(m.left, np.left);
  const originY = Math.max(m.top, np.top);
  const extentX = sw - Math.max(m.right, np.right);
  const extentY = sh - Math.max(m.bottom, np.bottom);
  const layW = clampToZero(extentX - originX);
  const layH = clampToZero(extentY - originY);

  return {
    sheet: { rawWidth: sw, rawHeight: sh, nonPrintable: np, effectiveWidth: effW, effectiveHeight: effH },
    document: { width: dw, height: dh },
    gutter: { horizontal: gh, vertical: gv },
    margins: m,
    layoutArea: { width: layW, height: layH, originX, originY },
  };
}

export function calculateDocumentCount(avail, span, gut) {
  if (avail <= 0 || span <= 0) return 0;
  const g = clampToZero(gut);
  return clampToZero(Math.floor((avail + g) / (span + g)));
}

export function calculateAxisUsage(avail, span, gut, count) {
  if (count <= 0) return { usedSpan: 0, trailingMargin: avail };
  const g = clampToZero(gut);
  const used = count * span + Math.max(0, count - 1) * g;
  return { usedSpan: used, trailingMargin: clampToZero(avail - used) };
}

export function calculateLayout(ctx) {
  const { layoutArea, document, gutter, margins, sheet } = ctx;
  const maxAcross = calculateDocumentCount(layoutArea.width, document.width, gutter.horizontal);
  const maxDown = calculateDocumentCount(layoutArea.height, document.height, gutter.vertical);
  const h = calculateAxisUsage(layoutArea.width, document.width, gutter.horizontal, maxAcross);
  const v = calculateAxisUsage(layoutArea.height, document.height, gutter.vertical, maxDown);
  const realizedLeft = clampToZero(layoutArea.originX);
  const realizedTop = clampToZero(layoutArea.originY);
  const docRightEdge = layoutArea.originX + h.usedSpan;
  const docBottomEdge = layoutArea.originY + v.usedSpan;
  const realizedRight = clampToZero(sheet.rawWidth - docRightEdge);
  const realizedBottom = clampToZero(sheet.rawHeight - docBottomEdge);

  return {
    sheet,
    margins,
    document,
    gutter,
    layoutArea,
    counts: { across: maxAcross, down: maxDown },
    usage: { horizontal: h, vertical: v },
    realizedMargins: {
      left: realizedLeft,
      top: realizedTop,
      right: realizedRight,
      bottom: realizedBottom,
    },
  };
}

export function applyCountOverrides(layout, desiredAcross, desiredDown) {
  const across = Math.min(layout.counts.across, desiredAcross ?? layout.counts.across);
  const down = Math.min(layout.counts.down, desiredDown ?? layout.counts.down);
  const h = calculateAxisUsage(layout.layoutArea.width, layout.document.width, layout.gutter.horizontal, across);
  const v = calculateAxisUsage(layout.layoutArea.height, layout.document.height, layout.gutter.vertical, down);
  const realizedLeft = clampToZero(layout.layoutArea.originX);
  const realizedTop = clampToZero(layout.layoutArea.originY);
  const docRightEdge = layout.layoutArea.originX + h.usedSpan;
  const docBottomEdge = layout.layoutArea.originY + v.usedSpan;
  const realizedRight = clampToZero(layout.sheet.rawWidth - docRightEdge);
  const realizedBottom = clampToZero(layout.sheet.rawHeight - docBottomEdge);

  return {
    ...layout,
    counts: { across, down },
    usage: { horizontal: h, vertical: v },
    realizedMargins: {
      left: realizedLeft,
      top: realizedTop,
      right: realizedRight,
      bottom: realizedBottom,
    },
  };
}
