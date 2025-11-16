import { createMeasurementId } from '../utils/dom.js';

function getNonPrintableMetrics(sheet = {}) {
  const region = sheet?.nonPrintable ?? {};
  return {
    top: Math.max(0, Number(region.top) || 0),
    right: Math.max(0, Number(region.right) || 0),
    bottom: Math.max(0, Number(region.bottom) || 0),
    left: Math.max(0, Number(region.left) || 0),
  };
}

function getPrintableDimensions(sheet, nonPrintable) {
  const width = Math.max(0, sheet.rawWidth - nonPrintable.left - nonPrintable.right);
  const height = Math.max(0, sheet.rawHeight - nonPrintable.top - nonPrintable.bottom);
  return { width, height };
}

function toCornerValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function resolveRoundedCorners(source) {
  const base = {
    topLeft: 0,
    topRight: 0,
    bottomRight: 0,
    bottomLeft: 0,
  };
  if (!source || typeof source !== 'object') return base;
  return {
    topLeft: toCornerValue(source.topLeft),
    topRight: toCornerValue(source.topRight),
    bottomRight: toCornerValue(source.bottomRight),
    bottomLeft: toCornerValue(source.bottomLeft),
  };
}

const hasRoundedCorners = (corners) => Object.values(corners).some((value) => value > 0);

function addRect(items, rect) {
  if (!rect) return;
  items.push({ type: 'rect', ...rect });
}

function addLine(items, line) {
  if (!line) return;
  items.push({ type: 'line', ...line });
}

function addCircle(items, circle) {
  if (!circle) return;
  items.push({ type: 'circle', ...circle });
}

export function buildLayoutScene(layout, finishing = {}) {
  if (!layout?.sheet) return null;
  const width = Number(layout.sheet.rawWidth ?? 0);
  const height = Number(layout.sheet.rawHeight ?? 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const items = [];

  addRect(items, {
    x: 0,
    y: 0,
    width,
    height,
    layer: 'sheet',
    classNames: ['svg-sheet-outline'],
  });

  const nonPrintable = getNonPrintableMetrics(layout.sheet);
  const printable = getPrintableDimensions(layout.sheet, nonPrintable);

  if (nonPrintable.top > 0) {
    addRect(items, {
      x: 0,
      y: 0,
      width,
      height: nonPrintable.top,
      layer: 'nonPrintable',
      classNames: ['svg-nonprintable-region'],
    });
  }

  if (nonPrintable.bottom > 0) {
    addRect(items, {
      x: 0,
      y: height - nonPrintable.bottom,
      width,
      height: nonPrintable.bottom,
      layer: 'nonPrintable',
      classNames: ['svg-nonprintable-region'],
    });
  }

  const verticalBandHeight = Math.max(0, height - nonPrintable.top - nonPrintable.bottom);
  if (nonPrintable.left > 0 && verticalBandHeight > 0) {
    addRect(items, {
      x: 0,
      y: nonPrintable.top,
      width: nonPrintable.left,
      height: verticalBandHeight,
      layer: 'nonPrintable',
      classNames: ['svg-nonprintable-region'],
    });
  }

  if (nonPrintable.right > 0 && verticalBandHeight > 0) {
    addRect(items, {
      x: width - nonPrintable.right,
      y: nonPrintable.top,
      width: nonPrintable.right,
      height: verticalBandHeight,
      layer: 'nonPrintable',
      classNames: ['svg-nonprintable-region'],
    });
  }

  if (printable.width > 0 && printable.height > 0) {
    addRect(items, {
      x: nonPrintable.left,
      y: nonPrintable.top,
      width: printable.width,
      height: printable.height,
      layer: 'nonPrintable',
      classNames: ['svg-printable-outline'],
    });
  }

  addRect(items, {
    x: layout.layoutArea.originX,
    y: layout.layoutArea.originY,
    width: layout.layoutArea.width,
    height: layout.layoutArea.height,
    layer: 'layout',
    classNames: ['svg-layout-area'],
  });

  const docCorners = resolveRoundedCorners(layout.roundedCorners);
  const shouldRoundDocs = hasRoundedCorners(docCorners);
  const across = layout.counts?.across ?? 0;
  const down = layout.counts?.down ?? 0;
  for (let yIndex = 0; yIndex < down; yIndex += 1) {
    for (let xIndex = 0; xIndex < across; xIndex += 1) {
      const originX = layout.layoutArea.originX + xIndex * (layout.document.width + layout.gutter.horizontal);
      const originY = layout.layoutArea.originY + yIndex * (layout.document.height + layout.gutter.vertical);
      addRect(items, {
        x: originX,
        y: originY,
        width: layout.document.width,
        height: layout.document.height,
        layer: 'docs',
        classNames: ['svg-document-area'],
        cornerRadii: shouldRoundDocs ? docCorners : null,
      });
    }
  }

  (finishing.cuts ?? []).forEach((cut, index) => {
    const y = Number(cut?.inches ?? 0);
    if (!Number.isFinite(y)) return;
    addLine(items, {
      x1: 0,
      y1: y,
      x2: width,
      y2: y,
      layer: 'cuts',
      classNames: ['svg-cut-line'],
      measurement: {
        id: createMeasurementId('cut', index),
        type: 'cut',
      },
    });
  });

  (finishing.slits ?? []).forEach((slit, index) => {
    const x = Number(slit?.inches ?? 0);
    if (!Number.isFinite(x)) return;
    addLine(items, {
      x1: x,
      y1: 0,
      x2: x,
      y2: height,
      layer: 'slits',
      classNames: ['svg-slit-line'],
      measurement: {
        id: createMeasurementId('slit', index),
        type: 'slit',
      },
    });
  });

  (finishing.scores?.horizontal ?? []).forEach((score, index) => {
    const y = Number(score?.inches ?? 0);
    if (!Number.isFinite(y)) return;
    addLine(items, {
      x1: layout.layoutArea.originX,
      y1: y,
      x2: layout.layoutArea.originX + layout.layoutArea.width,
      y2: y,
      layer: 'scores',
      classNames: ['svg-score-line'],
      measurement: {
        id: createMeasurementId('score-horizontal', index),
        type: 'score-horizontal',
      },
    });
  });

  (finishing.scores?.vertical ?? []).forEach((score, index) => {
    const x = Number(score?.inches ?? 0);
    if (!Number.isFinite(x)) return;
    addLine(items, {
      x1: x,
      y1: layout.layoutArea.originY,
      x2: x,
      y2: layout.layoutArea.originY + layout.layoutArea.height,
      layer: 'scores',
      classNames: ['svg-score-line'],
      measurement: {
        id: createMeasurementId('score-vertical', index),
        type: 'score-vertical',
      },
    });
  });

  (finishing.perforations?.horizontal ?? []).forEach((perforation, index) => {
    const y = Number(perforation?.inches ?? 0);
    if (!Number.isFinite(y)) return;
    addLine(items, {
      x1: layout.layoutArea.originX,
      y1: y,
      x2: layout.layoutArea.originX + layout.layoutArea.width,
      y2: y,
      layer: 'perforations',
      classNames: ['svg-perforation-line'],
      measurement: {
        id: createMeasurementId('perforation-horizontal', index),
        type: 'perforation-horizontal',
      },
    });
  });

  (finishing.perforations?.vertical ?? []).forEach((perforation, index) => {
    const x = Number(perforation?.inches ?? 0);
    if (!Number.isFinite(x)) return;
    addLine(items, {
      x1: x,
      y1: layout.layoutArea.originY,
      x2: x,
      y2: layout.layoutArea.originY + layout.layoutArea.height,
      layer: 'perforations',
      classNames: ['svg-perforation-line'],
      measurement: {
        id: createMeasurementId('perforation-vertical', index),
        type: 'perforation-vertical',
      },
    });
  });

  (finishing.holes ?? []).forEach((hole, index) => {
    const diameter = Number(hole?.diameter ?? 0);
    if (!Number.isFinite(diameter) || diameter <= 0) return;
    const radius = diameter / 2;
    const cx = Number(hole?.x ?? 0);
    const cy = Number(hole?.y ?? 0);
    addCircle(items, {
      cx,
      cy,
      radius,
      layer: 'holes',
      classNames: ['svg-hole'],
      measurement: {
        id: createMeasurementId('hole', index),
        type: 'hole',
      },
    });
  });

  return { width, height, items };
}
