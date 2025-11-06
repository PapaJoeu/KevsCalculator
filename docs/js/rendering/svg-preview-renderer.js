import {
  $,
  applyLayerVisibility,
  createMeasurementId,
  isMeasurementSelected,
  registerMeasurementId,
  restoreMeasurementSelections,
  setMeasurementHover,
  toggleMeasurementSelection,
} from '../utils/dom.js';

const SVG_COLORS = {
  layoutStroke: '#38bdf8',
  documentStroke: '#5eead4',
  documentFill: 'rgba(94, 234, 212, 0.18)',
  nonPrintableFill: 'rgba(249, 115, 22, 0.28)',
  nonPrintableStroke: '#f97316',
  cutStroke: '#22d3ee',
  slitStroke: '#facc15',
  scoreStroke: '#a855f7',
  perforationStroke: '#fb7185',
};

function applyLayerAttributes(el, layer) {
  if (!layer) return;
  el.dataset.layer = layer;
  el.setAttribute('class', `layer layer-${layer}`);
}

function createRectFactory(svg, s, offX, offY) {
  return function R(x, y, w, h, { stroke = '#26323e', strokeWidth = 1.5, fill = 'none', layer } = {}) {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', offX + x * s);
    r.setAttribute('y', offY + y * s);
    r.setAttribute('width', Math.max(0.5, w * s));
    r.setAttribute('height', Math.max(0.5, h * s));
    r.setAttribute('fill', fill);
    r.setAttribute('stroke', stroke);
    if (stroke !== 'none') {
      r.setAttribute('stroke-width', strokeWidth);
    }
    r.setAttribute('rx', 6);
    applyLayerAttributes(r, layer);
    svg.appendChild(r);
  };
}

function createLineFactory(svg, s, offX, offY) {
  return function L(
    x1,
    y1,
    x2,
    y2,
    { stroke = '#22d3ee', width = 1.5, layer, measureId, measureType, perforated = false } = {}
  ) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', offX + x1 * s);
    l.setAttribute('y1', offY + y1 * s);
    l.setAttribute('x2', offX + x2 * s);
    l.setAttribute('y2', offY + y2 * s);
    l.setAttribute('stroke', stroke);
    l.setAttribute('stroke-width', width);
    l.setAttribute('stroke-linecap', 'round');
    if (perforated) {
      l.setAttribute('stroke-dasharray', '6 4');
    }
    applyLayerAttributes(l, layer);
    if (measureId) {
      registerMeasurementId(measureId);
      l.dataset.measureId = measureId;
      l.classList.add('measurement-line');
      if (measureType) l.dataset.measureType = measureType;
      if (isMeasurementSelected(measureId)) {
        l.classList.add('is-selected');
      }
      l.addEventListener('mouseenter', () => setMeasurementHover(measureId, true));
      l.addEventListener('mouseleave', () => setMeasurementHover(measureId, false));
      l.addEventListener('click', () => toggleMeasurementSelection(measureId));
    }
    svg.appendChild(l);
  };
}

export function drawSVG(layout, fin) {
  const svg = $('#svg');
  const W = svg.viewBox.baseVal.width,
    H = svg.viewBox.baseVal.height;
  const pad = 20;
  svg.innerHTML = '';
  const sx = (W - 2 * pad) / layout.sheet.rawWidth,
    sy = (H - 2 * pad) / layout.sheet.rawHeight,
    s = Math.min(sx, sy);
  const offX = pad + (W - 2 * pad - layout.sheet.rawWidth * s) / 2;
  const offY = pad + (H - 2 * pad - layout.sheet.rawHeight * s) / 2;

  const R = createRectFactory(svg, s, offX, offY);
  const L = createLineFactory(svg, s, offX, offY);

  R(0, 0, layout.sheet.rawWidth, layout.sheet.rawHeight, { stroke: '#334155' });
  const np = layout.sheet?.nonPrintable ?? {};
  const npTop = Math.max(0, np.top ?? 0);
  const npRight = Math.max(0, np.right ?? 0);
  const npBottom = Math.max(0, np.bottom ?? 0);
  const npLeft = Math.max(0, np.left ?? 0);
  const printableWidth = Math.max(0, layout.sheet.rawWidth - npLeft - npRight);
  const printableHeight = Math.max(0, layout.sheet.rawHeight - npTop - npBottom);
  if (npTop > 0) {
    R(0, 0, layout.sheet.rawWidth, npTop, {
      stroke: 'none',
      fill: SVG_COLORS.nonPrintableFill,
      layer: 'nonPrintable',
    });
  }
  if (npBottom > 0) {
    R(0, layout.sheet.rawHeight - npBottom, layout.sheet.rawWidth, npBottom, {
      stroke: 'none',
      fill: SVG_COLORS.nonPrintableFill,
      layer: 'nonPrintable',
    });
  }
  const verticalBandHeight = Math.max(0, layout.sheet.rawHeight - npTop - npBottom);
  if (npLeft > 0 && verticalBandHeight > 0) {
    R(0, npTop, npLeft, verticalBandHeight, {
      stroke: 'none',
      fill: SVG_COLORS.nonPrintableFill,
      layer: 'nonPrintable',
    });
  }
  if (npRight > 0 && verticalBandHeight > 0) {
    R(layout.sheet.rawWidth - npRight, npTop, npRight, verticalBandHeight, {
      stroke: 'none',
      fill: SVG_COLORS.nonPrintableFill,
      layer: 'nonPrintable',
    });
  }
  if (printableWidth > 0 && printableHeight > 0) {
    R(npLeft, npTop, printableWidth, printableHeight, {
      stroke: SVG_COLORS.nonPrintableStroke,
      strokeWidth: 1,
      fill: 'none',
      layer: 'nonPrintable',
    });
  }
  R(layout.layoutArea.originX, layout.layoutArea.originY, layout.layoutArea.width, layout.layoutArea.height, {
    stroke: SVG_COLORS.layoutStroke,
    strokeWidth: 1.5,
    layer: 'layout',
  });
  const across = layout.counts.across,
    down = layout.counts.down;
  for (let y = 0; y < down; y++) {
    for (let x = 0; x < across; x++) {
      const dx = layout.layoutArea.originX + x * (layout.document.width + layout.gutter.horizontal);
      const dy = layout.layoutArea.originY + y * (layout.document.height + layout.gutter.vertical);
      R(dx, dy, layout.document.width, layout.document.height, {
        stroke: SVG_COLORS.documentStroke,
        strokeWidth: 1,
        fill: SVG_COLORS.documentFill,
        layer: 'docs',
      });
    }
  }
  fin.cuts.forEach((c, index) =>
    L(layout.layoutArea.originX, c.inches, layout.layoutArea.originX + layout.layoutArea.width, c.inches, {
      stroke: SVG_COLORS.cutStroke,
      width: 1,
      layer: 'cuts',
      measureId: createMeasurementId('cut', index),
      measureType: 'cut',
    })
  );
  fin.slits.forEach((s, index) =>
    L(s.inches, layout.layoutArea.originY, s.inches, layout.layoutArea.originY + layout.layoutArea.height, {
      stroke: SVG_COLORS.slitStroke,
      width: 1,
      layer: 'slits',
      measureId: createMeasurementId('slit', index),
      measureType: 'slit',
    })
  );
  fin.scores.horizontal.forEach((sc, index) => {
    const measureId = createMeasurementId('score-horizontal', index);
    L(layout.layoutArea.originX, sc.inches, layout.layoutArea.originX + layout.layoutArea.width, sc.inches, {
      stroke: SVG_COLORS.scoreStroke,
      width: 1,
      layer: 'scores',
      measureId,
      measureType: 'score-horizontal',
    });
  });
  fin.scores.vertical.forEach((sc, index) => {
    const measureId = createMeasurementId('score-vertical', index);
    L(sc.inches, layout.layoutArea.originY, sc.inches, layout.layoutArea.originY + layout.layoutArea.height, {
      stroke: SVG_COLORS.scoreStroke,
      width: 1,
      layer: 'scores',
      measureId,
      measureType: 'score-vertical',
    });
  });
  fin.perforations.horizontal.forEach((pf, index) => {
    const measureId = createMeasurementId('perforation-horizontal', index);
    L(layout.layoutArea.originX, pf.inches, layout.layoutArea.originX + layout.layoutArea.width, pf.inches, {
      stroke: SVG_COLORS.perforationStroke,
      width: 1,
      layer: 'perforations',
      measureId,
      measureType: 'perforation-horizontal',
      perforated: true,
    });
  });
  fin.perforations.vertical.forEach((pf, index) => {
    const measureId = createMeasurementId('perforation-vertical', index);
    L(pf.inches, layout.layoutArea.originY, pf.inches, layout.layoutArea.originY + layout.layoutArea.height, {
      stroke: SVG_COLORS.perforationStroke,
      width: 1,
      layer: 'perforations',
      measureId,
      measureType: 'perforation-vertical',
      perforated: true,
    });
  });

  applyLayerVisibility();
  restoreMeasurementSelections();
}
