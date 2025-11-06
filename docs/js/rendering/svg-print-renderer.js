import { applyLayerAttributes } from './svg-layer-attributes.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_LAYERS = ['sheet', 'nonPrintable', 'layout', 'docs', 'cuts', 'slits', 'scores', 'perforations', 'holes'];

function createSvgElement(tag) {
  return document.createElementNS(SVG_NS, tag);
}

function addClassNames(el, classNames) {
  if (!el || !classNames) return;
  if (typeof classNames === 'string') {
    const trimmed = classNames.trim();
    if (trimmed) {
      el.classList.add(...trimmed.split(/\s+/));
    }
    return;
  }
  if (Array.isArray(classNames) && classNames.length > 0) {
    el.classList.add(...classNames.filter(Boolean));
  }
}

function toLayerSet(layers) {
  if (!layers) return null;
  if (layers instanceof Set) return layers;
  if (Array.isArray(layers)) {
    return new Set(layers.filter(Boolean));
  }
  if (typeof layers === 'object') {
    const entries = Object.entries(layers).filter(([, value]) => Boolean(value));
    return new Set(entries.map(([key]) => key));
  }
  return null;
}

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

export function createPrintableSvg(layout, finishing, options = {}) {
  if (!layout?.sheet) return null;
  const { sheet } = layout;
  const width = Number(sheet.rawWidth ?? 0);
  const height = Number(sheet.rawHeight ?? 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const layerSet = toLayerSet(options.visibleLayers) ?? new Set(DEFAULT_LAYERS);
  const isLayerVisible = (layer) => layerSet.has(layer);

  const svg = createSvgElement('svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', `${width}in`);
  svg.setAttribute('height', `${height}in`);
  svg.setAttribute('aria-label', 'Printable layout visualizer');
  svg.classList.add('print-preview-svg');

  const drawRect = (x, y, rectWidth, rectHeight, { layer, classNames } = {}) => {
    const rect = createSvgElement('rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', rectWidth);
    rect.setAttribute('height', rectHeight);
    addClassNames(rect, classNames);
    applyLayerAttributes(rect, layer);
    svg.appendChild(rect);
  };

  const drawLine = (x1, y1, x2, y2, { layer, classNames } = {}) => {
    const line = createSvgElement('line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.classList.add('svg-line');
    addClassNames(line, classNames);
    applyLayerAttributes(line, layer);
    svg.appendChild(line);
  };

  const drawCircle = (cx, cy, radius, { layer, classNames } = {}) => {
    const circle = createSvgElement('circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', radius);
    addClassNames(circle, classNames);
    applyLayerAttributes(circle, layer);
    svg.appendChild(circle);
  };

  if (isLayerVisible('sheet')) {
    drawRect(0, 0, width, height, {
      layer: 'sheet',
      classNames: ['svg-sheet-outline'],
    });
  }

  const nonPrintable = getNonPrintableMetrics(sheet);
  const printable = getPrintableDimensions(sheet, nonPrintable);

  if (isLayerVisible('nonPrintable')) {
    if (nonPrintable.top > 0) {
      drawRect(0, 0, width, nonPrintable.top, {
        layer: 'nonPrintable',
        classNames: ['svg-nonprintable-region'],
      });
    }

    if (nonPrintable.bottom > 0) {
      drawRect(0, height - nonPrintable.bottom, width, nonPrintable.bottom, {
        layer: 'nonPrintable',
        classNames: ['svg-nonprintable-region'],
      });
    }

    const verticalBandHeight = Math.max(0, height - nonPrintable.top - nonPrintable.bottom);
    if (nonPrintable.left > 0 && verticalBandHeight > 0) {
      drawRect(0, nonPrintable.top, nonPrintable.left, verticalBandHeight, {
        layer: 'nonPrintable',
        classNames: ['svg-nonprintable-region'],
      });
    }

    if (nonPrintable.right > 0 && verticalBandHeight > 0) {
      drawRect(width - nonPrintable.right, nonPrintable.top, nonPrintable.right, verticalBandHeight, {
        layer: 'nonPrintable',
        classNames: ['svg-nonprintable-region'],
      });
    }

    if (printable.width > 0 && printable.height > 0) {
      drawRect(nonPrintable.left, nonPrintable.top, printable.width, printable.height, {
        layer: 'nonPrintable',
        classNames: ['svg-printable-outline'],
      });
    }
  }

  if (isLayerVisible('layout')) {
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
  }

  if (isLayerVisible('docs')) {
    const across = layout.counts?.across ?? 0;
    const down = layout.counts?.down ?? 0;
    for (let y = 0; y < down; y += 1) {
      for (let x = 0; x < across; x += 1) {
        const originX = layout.layoutArea.originX + x * (layout.document.width + layout.gutter.horizontal);
        const originY = layout.layoutArea.originY + y * (layout.document.height + layout.gutter.vertical);
        drawRect(originX, originY, layout.document.width, layout.document.height, {
          layer: 'docs',
          classNames: ['svg-document-area'],
        });
      }
    }
  }

  if (isLayerVisible('cuts')) {
    (finishing?.cuts ?? []).forEach((cut) => {
      drawLine(
        layout.layoutArea.originX,
        cut.inches,
        layout.layoutArea.originX + layout.layoutArea.width,
        cut.inches,
        {
          layer: 'cuts',
          classNames: ['svg-cut-line'],
        },
      );
    });
  }

  if (isLayerVisible('slits')) {
    (finishing?.slits ?? []).forEach((slit) => {
      drawLine(
        slit.inches,
        layout.layoutArea.originY,
        slit.inches,
        layout.layoutArea.originY + layout.layoutArea.height,
        {
          layer: 'slits',
          classNames: ['svg-slit-line'],
        },
      );
    });
  }

  if (isLayerVisible('scores')) {
    (finishing?.scores?.horizontal ?? []).forEach((score) => {
      drawLine(
        layout.layoutArea.originX,
        score.inches,
        layout.layoutArea.originX + layout.layoutArea.width,
        score.inches,
        {
          layer: 'scores',
          classNames: ['svg-score-line'],
        },
      );
    });

    (finishing?.scores?.vertical ?? []).forEach((score) => {
      drawLine(
        score.inches,
        layout.layoutArea.originY,
        score.inches,
        layout.layoutArea.originY + layout.layoutArea.height,
        {
          layer: 'scores',
          classNames: ['svg-score-line'],
        },
      );
    });
  }

  if (isLayerVisible('perforations')) {
    (finishing?.perforations?.horizontal ?? []).forEach((perforation) => {
      drawLine(
        layout.layoutArea.originX,
        perforation.inches,
        layout.layoutArea.originX + layout.layoutArea.width,
        perforation.inches,
        {
          layer: 'perforations',
          classNames: ['svg-perforation-line'],
        },
      );
    });

    (finishing?.perforations?.vertical ?? []).forEach((perforation) => {
      drawLine(
        perforation.inches,
        layout.layoutArea.originY,
        perforation.inches,
        layout.layoutArea.originY + layout.layoutArea.height,
        {
          layer: 'perforations',
          classNames: ['svg-perforation-line'],
        },
      );
    });
  }

  if (isLayerVisible('holes')) {
    (finishing?.holes ?? []).forEach((hole) => {
      const diameter = Number(hole?.diameter ?? 0);
      if (!Number.isFinite(diameter) || diameter <= 0) return;
      const radius = diameter / 2;
      const cx = Number(hole?.x ?? 0);
      const cy = Number(hole?.y ?? 0);
      drawCircle(cx, cy, radius, {
        layer: 'holes',
        classNames: ['svg-hole'],
      });
    });
  }

  return svg;
}
