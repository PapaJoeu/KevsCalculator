import { applyLayerAttributes } from './svg-layer-attributes.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_LAYERS = ['sheet', 'nonPrintable', 'layout', 'docs', 'cuts', 'slits', 'scores', 'perforations', 'holes'];

// Browsers assume 96 px = 1 inch when translating between physical units and
// screen pixels. We use the same conversion so every coordinate we draw can be
// expressed in inches, but ultimately rendered in pixels inside the SVG.
const PRINT_DPI = 96;

const INLINE_STYLE_MARKER = 'data-print-style';
const PRINTABLE_SVG_STYLES = `
  .svg-line { stroke-linecap: round; }
  .svg-sheet-outline { fill: none; stroke: #334155; stroke-width: 1.5px; }
  .svg-nonprintable-region { fill: rgba(249, 115, 22, 0.28); stroke: none; }
  .svg-printable-outline { fill: none; stroke: #f97316; stroke-width: 1px; }
  .svg-layout-area { fill: none; stroke: #38bdf8; stroke-width: 1.5px; }
  .svg-document-area { fill: rgba(94, 234, 212, 0.18); stroke: #5eead4; stroke-width: 1px; }
  .svg-cut-line { stroke: #22d3ee; stroke-width: 1px; }
  .svg-slit-line { stroke: #facc15; stroke-width: 1px; }
  .svg-score-line { stroke: #a855f7; stroke-width: 1px; }
  .svg-perforation-line { stroke: #fb7185; stroke-width: 1px; stroke-dasharray: 6 4; }
  .svg-hole { fill: rgba(37, 99, 235, 0.12); stroke: #2563eb; stroke-width: 1px; }
`;

function ensureInlineStyles(svg) {
  if (!svg) return;
  const existing = svg.querySelector(`style[${INLINE_STYLE_MARKER}="true"]`);
  if (existing) return;

  const styleEl = createSvgElement('style');
  styleEl.setAttribute('type', 'text/css');
  styleEl.setAttribute(INLINE_STYLE_MARKER, 'true');
  styleEl.textContent = PRINTABLE_SVG_STYLES.trim();
  svg.insertBefore(styleEl, svg.firstChild);
}

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

function createScaledDrawers(svg, scale) {
  // All of the calculations the layout engine produces are measured in inches.
  // The SVG, however, works in pixel space. The scale parameter tells us how
  // many pixels we should use for a single inch so that the final exported SVG
  // maintains the correct physical size when opened in another tool.
  const toPx = (value) => value * scale;

  const drawRect = (x, y, rectWidth, rectHeight, { layer, classNames } = {}) => {
    const rect = createSvgElement('rect');
    rect.setAttribute('x', toPx(x));
    rect.setAttribute('y', toPx(y));
    rect.setAttribute('width', toPx(rectWidth));
    rect.setAttribute('height', toPx(rectHeight));
    addClassNames(rect, classNames);
    applyLayerAttributes(rect, layer);
    svg.appendChild(rect);
  };

  const drawLine = (x1, y1, x2, y2, { layer, classNames } = {}) => {
    const line = createSvgElement('line');
    line.setAttribute('x1', toPx(x1));
    line.setAttribute('y1', toPx(y1));
    line.setAttribute('x2', toPx(x2));
    line.setAttribute('y2', toPx(y2));
    line.classList.add('svg-line');
    addClassNames(line, classNames);
    applyLayerAttributes(line, layer);
    svg.appendChild(line);
  };

  const drawCircle = (cx, cy, radius, { layer, classNames } = {}) => {
    const circle = createSvgElement('circle');
    circle.setAttribute('cx', toPx(cx));
    circle.setAttribute('cy', toPx(cy));
    circle.setAttribute('r', toPx(radius));
    addClassNames(circle, classNames);
    applyLayerAttributes(circle, layer);
    svg.appendChild(circle);
  };

  return { drawRect, drawLine, drawCircle };
}

function createSvgRoot(widthInches, heightInches) {
  // The exported SVG needs two pieces of information:
  //  1. The real world size, expressed via the width/height attributes using
  //     inch units. This guarantees the document prints at the same scale as
  //     the sheet definition.
  //  2. A pixel-based coordinate space (viewBox) that our drawing helpers can
  //     use. We pick a DPI of 96 so the SVG's internal coordinates match what
  //     browsers expect when converting between px and inches.
  const svg = createSvgElement('svg');
  const widthPx = widthInches * PRINT_DPI;
  const heightPx = heightInches * PRINT_DPI;

  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `0 0 ${widthPx} ${heightPx}`);
  svg.setAttribute('width', `${widthInches}in`);
  svg.setAttribute('height', `${heightInches}in`);
  svg.setAttribute('aria-label', 'Printable layout visualizer');
  svg.classList.add('print-preview-svg');

  return { svg, scale: PRINT_DPI };
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

  // Create the SVG root up front so we can derive drawing helpers that use the
  // same coordinate conversion for every element.
  const { svg, scale } = createSvgRoot(width, height);

  ensureInlineStyles(svg);

  const { drawRect, drawLine, drawCircle } = createScaledDrawers(svg, scale);

  if (isLayerVisible('sheet')) {
    // Always start with the raw sheet dimensions so we can see the true
    // material boundary, even if additional content extends inward.
    drawRect(0, 0, width, height, {
      layer: 'sheet',
      classNames: ['svg-sheet-outline'],
    });
  }

  const nonPrintable = getNonPrintableMetrics(sheet);
  const printable = getPrintableDimensions(sheet, nonPrintable);

  if (isLayerVisible('nonPrintable')) {
    // Highlight the unusable margin at the top of the sheet.
    if (nonPrintable.top > 0) {
      drawRect(0, 0, width, nonPrintable.top, {
        layer: 'nonPrintable',
        classNames: ['svg-nonprintable-region'],
      });
    }

    // Highlight the unusable margin at the bottom of the sheet.
    if (nonPrintable.bottom > 0) {
      drawRect(0, height - nonPrintable.bottom, width, nonPrintable.bottom, {
        layer: 'nonPrintable',
        classNames: ['svg-nonprintable-region'],
      });
    }

    const verticalBandHeight = Math.max(0, height - nonPrintable.top - nonPrintable.bottom);
    // The left margin is a vertical strip running between the top/bottom
    // exclusions. Only draw it if there is remaining vertical space.
    if (nonPrintable.left > 0 && verticalBandHeight > 0) {
      drawRect(0, nonPrintable.top, nonPrintable.left, verticalBandHeight, {
        layer: 'nonPrintable',
        classNames: ['svg-nonprintable-region'],
      });
    }

    // Mirror the same logic for the right margin.
    if (nonPrintable.right > 0 && verticalBandHeight > 0) {
      drawRect(width - nonPrintable.right, nonPrintable.top, nonPrintable.right, verticalBandHeight, {
        layer: 'nonPrintable',
        classNames: ['svg-nonprintable-region'],
      });
    }

    // Draw the printable rectangle so users can easily see the usable area.
    if (printable.width > 0 && printable.height > 0) {
      drawRect(nonPrintable.left, nonPrintable.top, printable.width, printable.height, {
        layer: 'nonPrintable',
        classNames: ['svg-printable-outline'],
      });
    }
  }

  if (isLayerVisible('layout')) {
    // The layout area tells us where the repeating document grid should start
    // and how much space it consumes overall.
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
        // Each document is offset from the layout origin by the gutter spacing
        // plus the width/height of the previous items.
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
    // Horizontal cuts span the full layout width and are measured from the top
    // edge of the sheet, just like in the interactive preview.
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
    // Vertical slits run along the height of the layout area.
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
    // Scores can run horizontally or vertically; render each group separately
    // so we can mirror the preview ordering.
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
    // Perforations mirror the score logic but use a dashed stroke so the
    // printable export matches the preview legend.
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
    // The layout keeps hole diameters in inches, so divide by two to convert to
    // a radius for the SVG circle element.
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
