import {
  $,
  applyLayerVisibility,
  createMeasurementId,
  restoreMeasurementSelections,
} from '../utils/dom.js';
import { createCircleFactory, createLineFactory, createRectFactory } from './svg-shape-factories.js';

function getNonPrintableMetrics(sheet) {
  const nonPrintable = sheet?.nonPrintable ?? {};
  return {
    top: Math.max(0, nonPrintable.top ?? 0),
    right: Math.max(0, nonPrintable.right ?? 0),
    bottom: Math.max(0, nonPrintable.bottom ?? 0),
    left: Math.max(0, nonPrintable.left ?? 0),
  };
}

function getPrintableDimensions(sheet, nonPrintable) {
  const width = Math.max(0, sheet.rawWidth - nonPrintable.left - nonPrintable.right);
  const height = Math.max(0, sheet.rawHeight - nonPrintable.top - nonPrintable.bottom);

  return { width, height };
}

export function drawSVG(layout, fin) {
  const svg = $('#svg');
  const { width: viewBoxWidth, height: viewBoxHeight } = svg.viewBox.baseVal;
  const padding = 20;

  svg.innerHTML = '';

  const scaleX = (viewBoxWidth - 2 * padding) / layout.sheet.rawWidth;
  const scaleY = (viewBoxHeight - 2 * padding) / layout.sheet.rawHeight;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = padding + (viewBoxWidth - 2 * padding - layout.sheet.rawWidth * scale) / 2;
  const offsetY = padding + (viewBoxHeight - 2 * padding - layout.sheet.rawHeight * scale) / 2;

  const drawRect = createRectFactory(svg, scale, offsetX, offsetY);
  const drawLine = createLineFactory(svg, scale, offsetX, offsetY);
  const drawCircle = createCircleFactory(svg, scale, offsetX, offsetY);

  drawRect(0, 0, layout.sheet.rawWidth, layout.sheet.rawHeight, {
    layer: 'sheet',
    classNames: ['svg-sheet-outline'],
  });

  const nonPrintable = getNonPrintableMetrics(layout.sheet);
  const printable = getPrintableDimensions(layout.sheet, nonPrintable);

  if (nonPrintable.top > 0) {
    drawRect(0, 0, layout.sheet.rawWidth, nonPrintable.top, {
      layer: 'nonPrintable',
      classNames: ['svg-nonprintable-region'],
    });
  }

  if (nonPrintable.bottom > 0) {
    drawRect(0, layout.sheet.rawHeight - nonPrintable.bottom, layout.sheet.rawWidth, nonPrintable.bottom, {
      layer: 'nonPrintable',
      classNames: ['svg-nonprintable-region'],
    });
  }

  const verticalBandHeight = Math.max(0, layout.sheet.rawHeight - nonPrintable.top - nonPrintable.bottom);
  if (nonPrintable.left > 0 && verticalBandHeight > 0) {
    drawRect(0, nonPrintable.top, nonPrintable.left, verticalBandHeight, {
      layer: 'nonPrintable',
      classNames: ['svg-nonprintable-region'],
    });
  }

  if (nonPrintable.right > 0 && verticalBandHeight > 0) {
    drawRect(
      layout.sheet.rawWidth - nonPrintable.right,
      nonPrintable.top,
      nonPrintable.right,
      verticalBandHeight,
      {
        layer: 'nonPrintable',
        classNames: ['svg-nonprintable-region'],
      },
    );
  }

  if (printable.width > 0 && printable.height > 0) {
    drawRect(nonPrintable.left, nonPrintable.top, printable.width, printable.height, {
      layer: 'nonPrintable',
      classNames: ['svg-printable-outline'],
    });
  }

  drawRect(
    layout.layoutArea.originX,
    layout.layoutArea.originY,
    layout.layoutArea.width,
    layout.layoutArea.height,
    {
      layer: 'layout',
      classNames: ['svg-layout-area'],
    },
  );

  const across = layout.counts.across;
  const down = layout.counts.down;

  for (let y = 0; y < down; y++) {
    for (let x = 0; x < across; x++) {
      const documentOriginX =
        layout.layoutArea.originX + x * (layout.document.width + layout.gutter.horizontal);
      const documentOriginY =
        layout.layoutArea.originY + y * (layout.document.height + layout.gutter.vertical);

      drawRect(documentOriginX, documentOriginY, layout.document.width, layout.document.height, {
        layer: 'docs',
        classNames: ['svg-document-area'],
      });
    }
  }

  fin.cuts.forEach((cut, index) =>
    drawLine(
      layout.layoutArea.originX,
      cut.inches,
      layout.layoutArea.originX + layout.layoutArea.width,
      cut.inches,
      {
        layer: 'cuts',
        classNames: ['svg-cut-line'],
        measurement: {
          id: createMeasurementId('cut', index),
          type: 'cut',
        },
      },
    ),
  );

  fin.slits.forEach((slit, index) =>
    drawLine(slit.inches, layout.layoutArea.originY, slit.inches, layout.layoutArea.originY + layout.layoutArea.height, {
      layer: 'slits',
      classNames: ['svg-slit-line'],
      measurement: {
        id: createMeasurementId('slit', index),
        type: 'slit',
      },
    }),
  );

  fin.scores.horizontal.forEach((score, index) => {
    drawLine(
      layout.layoutArea.originX,
      score.inches,
      layout.layoutArea.originX + layout.layoutArea.width,
      score.inches,
      {
        layer: 'scores',
        classNames: ['svg-score-line'],
        measurement: {
          id: createMeasurementId('score-horizontal', index),
          type: 'score-horizontal',
        },
      },
    );
  });

  fin.scores.vertical.forEach((score, index) => {
    drawLine(
      score.inches,
      layout.layoutArea.originY,
      score.inches,
      layout.layoutArea.originY + layout.layoutArea.height,
      {
        layer: 'scores',
        classNames: ['svg-score-line'],
        measurement: {
          id: createMeasurementId('score-vertical', index),
          type: 'score-vertical',
        },
      },
    );
  });

  fin.perforations.horizontal.forEach((perforation, index) => {
    drawLine(
      layout.layoutArea.originX,
      perforation.inches,
      layout.layoutArea.originX + layout.layoutArea.width,
      perforation.inches,
      {
        layer: 'perforations',
        classNames: ['svg-perforation-line'],
        measurement: {
          id: createMeasurementId('perforation-horizontal', index),
          type: 'perforation-horizontal',
        },
      },
    );
  });

  fin.perforations.vertical.forEach((perforation, index) => {
    drawLine(
      perforation.inches,
      layout.layoutArea.originY,
      perforation.inches,
      layout.layoutArea.originY + layout.layoutArea.height,
      {
        layer: 'perforations',
        classNames: ['svg-perforation-line'],
        measurement: {
          id: createMeasurementId('perforation-vertical', index),
          type: 'perforation-vertical',
        },
      },
    );
  });

  (fin.holes ?? []).forEach((hole, index) => {
    const diameter = Number(hole?.diameter ?? 0);
    if (!Number.isFinite(diameter) || diameter <= 0) return;
    const radius = diameter / 2;
    drawCircle(hole.x ?? 0, hole.y ?? 0, radius, {
      layer: 'holes',
      classNames: ['svg-hole'],
      measurement: {
        id: createMeasurementId('hole', index),
        type: 'hole',
      },
    });
  });

  applyLayerVisibility();
  restoreMeasurementSelections();
}
