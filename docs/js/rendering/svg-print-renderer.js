import { buildRoundedRectPath, clampCornerRadii, normalizeCornerRadii, scaleCornerRadii } from './rounded-rect-path.js';
import { buildLayoutScene } from './svg-layout-scene.js';
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

function createScaledDrawers(svg, scale) {
  // All of the calculations the layout engine produces are measured in inches.
  // The SVG, however, works in pixel space. The scale parameter tells us how
  // many pixels we should use for a single inch so that the final exported SVG
  // maintains the correct physical size when opened in another tool.
  const toPx = (value) => value * scale;

  const drawRect = (x, y, rectWidth, rectHeight, { layer, classNames, cornerRadii } = {}) => {
    const normalized = normalizeCornerRadii(cornerRadii);
    const rounded = clampCornerRadii(normalized, rectWidth, rectHeight);
    const pxX = toPx(x);
    const pxY = toPx(y);
    const pxWidth = toPx(rectWidth);
    const pxHeight = toPx(rectHeight);

    if (rounded) {
      const path = createSvgElement('path');
      const scaledRadii = scaleCornerRadii(rounded, scale);
      path.setAttribute('d', buildRoundedRectPath(pxX, pxY, pxWidth, pxHeight, scaledRadii));
      addClassNames(path, classNames);
      applyLayerAttributes(path, layer);
      svg.appendChild(path);
      return;
    }

    const rect = createSvgElement('rect');
    rect.setAttribute('x', pxX);
    rect.setAttribute('y', pxY);
    rect.setAttribute('width', pxWidth);
    rect.setAttribute('height', pxHeight);
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
  const scene = buildLayoutScene(layout, finishing);
  if (!scene) return null;
  const width = scene.width;
  const height = scene.height;

  const layerSet = toLayerSet(options.visibleLayers) ?? new Set(DEFAULT_LAYERS);
  const isLayerVisible = (layer) => layerSet.has(layer);

  // Create the SVG root up front so we can derive drawing helpers that use the
  // same coordinate conversion for every element.
  const { svg, scale } = createSvgRoot(width, height);

  ensureInlineStyles(svg);

  const { drawRect, drawLine, drawCircle } = createScaledDrawers(svg, scale);

  scene.items.forEach((item) => {
    if (!item || !isLayerVisible(item.layer)) return;
    if (item.type === 'rect') {
      drawRect(item.x, item.y, item.width, item.height, {
        layer: item.layer,
        classNames: item.classNames,
        cornerRadii: item.cornerRadii,
      });
      return;
    }
    if (item.type === 'line') {
      drawLine(item.x1, item.y1, item.x2, item.y2, {
        layer: item.layer,
        classNames: item.classNames,
      });
      return;
    }
    if (item.type === 'circle') {
      drawCircle(item.cx, item.cy, item.radius, {
        layer: item.layer,
        classNames: item.classNames,
      });
    }
  });

  return svg;
}
