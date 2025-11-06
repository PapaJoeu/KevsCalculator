import { DEFAULT_INPUTS } from './config/defaults.js';
import { layoutPresets } from './data/layout-presets.js';
import { initializeTabRegistry, registerTab } from './tabs/registry.js';
import inputsTab, { isAutoMarginModeEnabled, enableAutoMarginMode } from './tabs/inputs.js';
import summaryTab from './tabs/summary.js';
import finishingTab from './tabs/finishing.js';
import scoresTab from './tabs/scores.js';
import perforationsTab from './tabs/perforations.js';
import warningsTab from './tabs/warnings.js';
import printTab from './tabs/print.js';
import presetsTab from './tabs/presets.js';
import {
  MM_PER_INCH,
  clampToZero,
  toNumber,
  inchesToMillimeters,
} from './utils/units.js';
import {
  $,
  createMeasurementId,
  fillTable,
  isMeasurementSelected,
  parseOffsets,
  readIntOptional,
  readNumber,
  registerMeasurementId,
  resetMeasurementRegistry,
  restoreMeasurementSelections,
  setMeasurementHover,
  toggleMeasurementSelection,
} from './utils/dom.js';

// ============================================================
// Print Layout Calculator — Application Script
// ------------------------------------------------------------
// The logic is organized in the following sections:
//   1. Calculation helpers (core math + data shaping)
//   2. UI utilities (DOM helpers and formatting)
//   3. Rendering + state updates (populate UI and SVG)
//   4. Event bindings (wire up interactions)
//   5. Initialization (bootstraps the default view)
// ============================================================

// ------------------------------------------------------------
// 1. Calculation helpers
// ------------------------------------------------------------
const normalizePerSide = (s = {}) => ({
  top: toNumber(s.top),
  right: toNumber(s.right),
  bottom: toNumber(s.bottom),
  left: toNumber(s.left),
});

function createCalculationContext({ sheet, document, gutter, margins = {}, nonPrintable = {} }) {
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

  // Margins are interpreted from the sheet edge.  Clamp the layout so that it
  // never crosses into the non-printable band while honoring the requested
  // inset when it is farther from the edge than the non-printable allowance.
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

function calculateDocumentCount(avail, span, gut) {
  if (avail <= 0 || span <= 0) return 0;
  const g = clampToZero(gut);
  return clampToZero(Math.floor((avail + g) / (span + g)));
}

function calculateAxisUsage(avail, span, gut, count) {
  if (count <= 0) return { usedSpan: 0, trailingMargin: avail };
  const g = clampToZero(gut);
  const used = count * span + Math.max(0, count - 1) * g;
  return { usedSpan: used, trailingMargin: clampToZero(avail - used) };
}

function calculateLayout(ctx) {
  const { layoutArea, document, gutter, margins, sheet } = ctx;
  const maxAcross = calculateDocumentCount(layoutArea.width, document.width, gutter.horizontal);
  const maxDown = calculateDocumentCount(layoutArea.height, document.height, gutter.vertical);
  const h = calculateAxisUsage(layoutArea.width, document.width, gutter.horizontal, maxAcross);
  const v = calculateAxisUsage(layoutArea.height, document.height, gutter.vertical, maxDown);
  // Report realized margins from the actual sheet edge instead of the
  // user-requested values so that any clamping against the non-printable
  // perimeter is visible in the summary.
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

function applyCountOverrides(layout, desiredAcross, desiredDown) {
  const across = Math.min(layout.counts.across, desiredAcross ?? layout.counts.across);
  const down = Math.min(layout.counts.down, desiredDown ?? layout.counts.down);
  const h = calculateAxisUsage(layout.layoutArea.width, layout.document.width, layout.gutter.horizontal, across);
  const v = calculateAxisUsage(layout.layoutArea.height, layout.document.height, layout.gutter.vertical, down);
  // Recompute realized margins after enforcing explicit row/column counts so
  // the summary reflects the final document footprint against the sheet edge.
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

function generateEdgePositions(startOffset, docSpan, gutterSpan, docCount) {
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

function generateScorePositions(startOffset, docSpan, gutterSpan, docCount, offsets) {
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

if (typeof console !== "undefined") {
  const regressionPositions = generateEdgePositions(0, 1, 0, 2);
  console.assert(
    regressionPositions.length === 3 && new Set(regressionPositions).size === 3,
    "Expected unique cut positions for zero gutter layouts."
  );
}

const mapPositionsToReadout = (label, positions) =>
  positions.map((p, i) => ({
    label: `${label} ${i + 1}`,
    inches: Number(p.toFixed(3)),
    millimeters: inchesToMillimeters(p),
  }));

function calculateFinishing(layout, options = {}) {
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
  return {
    cuts: mapPositionsToReadout("Cut", hEdges),
    slits: mapPositionsToReadout("Slit", vEdges),
    scores: {
      horizontal: mapPositionsToReadout("Score", hScores),
      vertical: mapPositionsToReadout("Score", vScores),
    },
    perforations: {
      horizontal: mapPositionsToReadout("Perforation", hPerforations),
      vertical: mapPositionsToReadout("Perforation", vPerforations),
    },
  };
}

// ------------------------------------------------------------
// 2. UI utilities
// ------------------------------------------------------------
const fmtIn = (inches) => `${inches.toFixed(3)} in / ${inchesToMillimeters(inches).toFixed(2)} mm`;

function currentInputs() {
  const units = $('#units').value;
  const u = (v) => (units === 'mm' ? (Number(v) || 0) / MM_PER_INCH : Number(v) || 0);
  const autoMargins = isAutoMarginModeEnabled();
  const rawMargins = {
    top: u(readNumber('#mTop')),
    right: u(readNumber('#mRight')),
    bottom: u(readNumber('#mBottom')),
    left: u(readNumber('#mLeft')),
  };
  return {
    units,
    sheet: { width: u(readNumber('#sheetW')), height: u(readNumber('#sheetH')) },
    document: { width: u(readNumber('#docW')), height: u(readNumber('#docH')) },
    gutter: { horizontal: u(readNumber('#gutH')), vertical: u(readNumber('#gutV')) },
    margins: autoMargins ? { top: 0, right: 0, bottom: 0, left: 0 } : rawMargins,
    nonPrintable: {
      top: u(readNumber('#npTop')),
      right: u(readNumber('#npRight')),
      bottom: u(readNumber('#npBottom')),
      left: u(readNumber('#npLeft')),
    },
    scoreV: parseOffsets($('#scoresV')?.value || ''),
    scoreH: parseOffsets($('#scoresH')?.value || ''),
    perfV: parseOffsets($('#perfV')?.value || ''),
    perfH: parseOffsets($('#perfH')?.value || ''),
    forceAcross: readIntOptional('#forceAcross'),
    forceDown: readIntOptional('#forceDown'),
    autoMargins,
  };
}

function status(txt) {
  $("#status").textContent = txt;
}

// ------------------------------------------------------------
// 3. Rendering + state updates
// ------------------------------------------------------------
function update() {
  const inp = currentInputs();
  let ctx = createCalculationContext(inp);
  let layout = calculateLayout(ctx);
  layout = applyCountOverrides(layout, inp.forceAcross, inp.forceDown);

  // Auto-center margins while auto mode is active
  if (inp.autoMargins) {
    const effW = ctx.sheet.effectiveWidth,
      effH = ctx.sheet.effectiveHeight;
    const usedW = layout.usage.horizontal.usedSpan,
      usedH = layout.usage.vertical.usedSpan;
    const printableLeftoverX = clampToZero((effW - usedW) / 2);
    const printableLeftoverY = clampToZero((effH - usedH) / 2);
    const leftMargin = ctx.sheet.nonPrintable.left + printableLeftoverX;
    const rightMargin = ctx.sheet.nonPrintable.right + printableLeftoverX;
    const topMargin = ctx.sheet.nonPrintable.top + printableLeftoverY;
    const bottomMargin = ctx.sheet.nonPrintable.bottom + printableLeftoverY;
    ctx = createCalculationContext({
      sheet: { width: ctx.sheet.rawWidth, height: ctx.sheet.rawHeight },
      document: ctx.document,
      gutter: ctx.gutter,
      margins: { top: topMargin, right: rightMargin, bottom: bottomMargin, left: leftMargin },
      nonPrintable: ctx.sheet.nonPrintable,
    });
    layout = calculateLayout(ctx);
    layout = applyCountOverrides(layout, inp.forceAcross, inp.forceDown);
    const f = (inches) => (inp.units === "mm" ? (inches * MM_PER_INCH).toFixed(3) : inches.toFixed(3));
    $("#mTop").value = f(topMargin);
    $("#mRight").value = f(rightMargin);
    $("#mBottom").value = f(bottomMargin);
    $("#mLeft").value = f(leftMargin);
  }

  resetMeasurementRegistry();
  const fin = calculateFinishing(layout, {
    scoreHorizontal: inp.scoreH,
    scoreVertical: inp.scoreV,
    perforationHorizontal: inp.perfH,
    perforationVertical: inp.perfV,
  });

  // Summary
  $("#vAcross").textContent = layout.counts.across;
  $("#vDown").textContent = layout.counts.down;
  $("#vTotal").textContent = layout.counts.across * layout.counts.down;
  $("#vLayout").textContent = `${layout.layoutArea.width.toFixed(3)} × ${layout.layoutArea.height.toFixed(3)} in`;
  $("#vOrigin").textContent = `x ${layout.layoutArea.originX.toFixed(3)}, y ${layout.layoutArea.originY.toFixed(3)} in`;
  $("#vRealMargins").textContent = `L ${layout.realizedMargins.left.toFixed(3)}, T ${layout.realizedMargins.top.toFixed(3)}, R ${layout.realizedMargins.right.toFixed(3)}, B ${layout.realizedMargins.bottom.toFixed(3)} in`;
  $("#vUsed").textContent = `${layout.usage.horizontal.usedSpan.toFixed(3)} × ${layout.usage.vertical.usedSpan.toFixed(3)} in`;
  $("#vTrail").textContent = `${layout.usage.horizontal.trailingMargin.toFixed(3)} × ${layout.usage.vertical.trailingMargin.toFixed(3)} in`;

  fillTable($("#tblCuts tbody"), fin.cuts, 'cut');
  fillTable($("#tblSlits tbody"), fin.slits, 'slit');
  fillTable($("#tblScoresH tbody"), fin.scores.horizontal, 'score-horizontal');
  fillTable($("#tblScoresV tbody"), fin.scores.vertical, 'score-vertical');
  fillTable($("#tblPerforationsH tbody"), fin.perforations.horizontal, 'perforation-horizontal');
  fillTable($("#tblPerforationsV tbody"), fin.perforations.vertical, 'perforation-vertical');

  $("#pSheet").textContent = fmtIn(ctx.sheet.rawWidth) + " × " + fmtIn(ctx.sheet.rawHeight);
  $("#pDoc").textContent = fmtIn(ctx.document.width) + " × " + fmtIn(ctx.document.height);
  $("#pCounts").textContent = `${layout.counts.across} × ${layout.counts.down} = ${layout.counts.across * layout.counts.down}`;
  $("#pGutter").textContent = `${fmtIn(ctx.gutter.horizontal)} (H), ${fmtIn(ctx.gutter.vertical)} (V)`;
  $("#pMargins").textContent = `T ${fmtIn(ctx.margins.top)}, R ${fmtIn(ctx.margins.right)}, B ${fmtIn(ctx.margins.bottom)}, L ${fmtIn(ctx.margins.left)}`;

  drawSVG(layout, fin);
  status("Updated");
}

function drawSVG(layout, fin) {
  const svg = $("#svg");
  const W = svg.viewBox.baseVal.width,
    H = svg.viewBox.baseVal.height;
  const pad = 20;
  svg.innerHTML = "";
  const sx = (W - 2 * pad) / layout.sheet.rawWidth,
    sy = (H - 2 * pad) / layout.sheet.rawHeight,
    s = Math.min(sx, sy);
  const offX = pad + ((W - 2 * pad - layout.sheet.rawWidth * s) / 2);
  const offY = pad + ((H - 2 * pad - layout.sheet.rawHeight * s) / 2);
  const colors = {
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

  const applyLayerAttributes = (el, layer) => {
    if (!layer) return;
    el.dataset.layer = layer;
    el.setAttribute("class", `layer layer-${layer}`);
  };
  const R = (x, y, w, h, { stroke = "#26323e", strokeWidth = 1.5, fill = "none", layer } = {}) => {
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", offX + x * s);
    r.setAttribute("y", offY + y * s);
    r.setAttribute("width", Math.max(0.5, w * s));
    r.setAttribute("height", Math.max(0.5, h * s));
    r.setAttribute("fill", fill);
    r.setAttribute("stroke", stroke);
    if (stroke !== "none") {
      r.setAttribute("stroke-width", strokeWidth);
    }
    r.setAttribute("rx", 6);
    applyLayerAttributes(r, layer);
    svg.appendChild(r);
  };
  const L = (
    x1,
    y1,
    x2,
    y2,
    { stroke = "#22d3ee", width = 1.5, layer, measureId, measureType, perforated = false } = {}
  ) => {
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", offX + x1 * s);
    l.setAttribute("y1", offY + y1 * s);
    l.setAttribute("x2", offX + x2 * s);
    l.setAttribute("y2", offY + y2 * s);
    l.setAttribute("stroke", stroke);
    l.setAttribute("stroke-width", width);
    l.setAttribute("stroke-linecap", "round");
    if (perforated) {
      l.setAttribute("stroke-dasharray", "6 4");
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
  R(0, 0, layout.sheet.rawWidth, layout.sheet.rawHeight, { stroke: "#334155" });
  const np = layout.sheet?.nonPrintable ?? {};
  const npTop = Math.max(0, np.top ?? 0);
  const npRight = Math.max(0, np.right ?? 0);
  const npBottom = Math.max(0, np.bottom ?? 0);
  const npLeft = Math.max(0, np.left ?? 0);
  const printableWidth = Math.max(0, layout.sheet.rawWidth - npLeft - npRight);
  const printableHeight = Math.max(0, layout.sheet.rawHeight - npTop - npBottom);
  if (npTop > 0) {
    R(0, 0, layout.sheet.rawWidth, npTop, {
      stroke: "none",
      fill: colors.nonPrintableFill,
      layer: "nonPrintable",
    });
  }
  if (npBottom > 0) {
    R(0, layout.sheet.rawHeight - npBottom, layout.sheet.rawWidth, npBottom, {
      stroke: "none",
      fill: colors.nonPrintableFill,
      layer: "nonPrintable",
    });
  }
  const verticalBandHeight = Math.max(0, layout.sheet.rawHeight - npTop - npBottom);
  if (npLeft > 0 && verticalBandHeight > 0) {
    R(0, npTop, npLeft, verticalBandHeight, {
      stroke: "none",
      fill: colors.nonPrintableFill,
      layer: "nonPrintable",
    });
  }
  if (npRight > 0 && verticalBandHeight > 0) {
    R(layout.sheet.rawWidth - npRight, npTop, npRight, verticalBandHeight, {
      stroke: "none",
      fill: colors.nonPrintableFill,
      layer: "nonPrintable",
    });
  }
  if (printableWidth > 0 && printableHeight > 0) {
    R(npLeft, npTop, printableWidth, printableHeight, {
      stroke: colors.nonPrintableStroke,
      strokeWidth: 1,
      fill: "none",
      layer: "nonPrintable",
    });
  }
  R(layout.layoutArea.originX, layout.layoutArea.originY, layout.layoutArea.width, layout.layoutArea.height, {
    stroke: colors.layoutStroke,
    strokeWidth: 1.5,
    layer: "layout",
  });
  const across = layout.counts.across,
    down = layout.counts.down;
  for (let y = 0; y < down; y++) {
    for (let x = 0; x < across; x++) {
      const dx = layout.layoutArea.originX + x * (layout.document.width + layout.gutter.horizontal);
      const dy = layout.layoutArea.originY + y * (layout.document.height + layout.gutter.vertical);
      R(dx, dy, layout.document.width, layout.document.height, {
        stroke: colors.documentStroke,
        strokeWidth: 1,
        fill: colors.documentFill,
        layer: "docs",
      });
    }
  }
  fin.cuts.forEach((c, index) =>
    L(layout.layoutArea.originX, c.inches, layout.layoutArea.originX + layout.layoutArea.width, c.inches, {
      stroke: colors.cutStroke,
      width: 1,
      layer: "cuts",
      measureId: createMeasurementId('cut', index),
      measureType: 'cut',
    })
  );
  fin.slits.forEach((s, index) =>
    L(s.inches, layout.layoutArea.originY, s.inches, layout.layoutArea.originY + layout.layoutArea.height, {
      stroke: colors.slitStroke,
      width: 1,
      layer: "slits",
      measureId: createMeasurementId('slit', index),
      measureType: 'slit',
    })
  );
  fin.scores.horizontal.forEach((sc, index) => {
    const measureId = createMeasurementId('score-horizontal', index);
    L(layout.layoutArea.originX, sc.inches, layout.layoutArea.originX + layout.layoutArea.width, sc.inches, {
      stroke: colors.scoreStroke,
      width: 1,
      layer: "scores",
      measureId,
      measureType: 'score-horizontal',
    });
  });
  fin.scores.vertical.forEach((sc, index) => {
    const measureId = createMeasurementId('score-vertical', index);
    L(sc.inches, layout.layoutArea.originY, sc.inches, layout.layoutArea.originY + layout.layoutArea.height, {
      stroke: colors.scoreStroke,
      width: 1,
      layer: "scores",
      measureId,
      measureType: 'score-vertical',
    });
  });
  fin.perforations.horizontal.forEach((pf, index) => {
    const measureId = createMeasurementId('perforation-horizontal', index);
    L(layout.layoutArea.originX, pf.inches, layout.layoutArea.originX + layout.layoutArea.width, pf.inches, {
      stroke: colors.perforationStroke,
      width: 1,
      layer: "perforations",
      measureId,
      measureType: 'perforation-horizontal',
      perforated: true,
    });
  });
  fin.perforations.vertical.forEach((pf, index) => {
    const measureId = createMeasurementId('perforation-vertical', index);
    L(pf.inches, layout.layoutArea.originY, pf.inches, layout.layoutArea.originY + layout.layoutArea.height, {
      stroke: colors.perforationStroke,
      width: 1,
      layer: "perforations",
      measureId,
      measureType: 'perforation-vertical',
      perforated: true,
    });
  });
  applyLayerVisibility();
  restoreMeasurementSelections();
}

// ------------------------------------------------------------
// 4. Event bindings
// ------------------------------------------------------------
const tabRegistrations = [
  { module: inputsTab, context: { update, status } },
  { module: summaryTab, context: {} },
  { module: finishingTab, context: {} },
  { module: scoresTab, context: { update, status } },
  { module: perforationsTab, context: { update, status } },
  { module: warningsTab, context: {} },
  { module: printTab, context: {} },
  {
    module: presetsTab,
    context: {
      update,
      status,
      enableAutoMarginMode,
      scoresApi: scoresTab.api,
      perforationsApi: perforationsTab.api,
      layoutPresets,
    },
  },
];

tabRegistrations.forEach(({ module, context }) => {
  registerTab(module.key, module, context);
  if (typeof module.init === 'function') {
    module.init(context);
  }
});

initializeTabRegistry();

// ------------------------------------------------------------
// 5. Initialization & sanity checks
// ------------------------------------------------------------
(function tests() {
  console.assert(inchesToMillimeters(1) === 25.4, '1 inch should be 25.4 mm');
  console.assert(calculateDocumentCount(10, 2, 0) === 5, '10/2=5 docs');
  const ctx = createCalculationContext({
    sheet: { ...DEFAULT_INPUTS.sheet },
    document: { ...DEFAULT_INPUTS.document },
    gutter: { ...DEFAULT_INPUTS.gutter },
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    nonPrintable: { ...DEFAULT_INPUTS.nonPrintable },
  });
  const layout = calculateLayout(ctx);
  console.assert(layout.counts.across >= 1 && layout.counts.down >= 1, 'Counts should be >=1 with defaults');
})();

update();
