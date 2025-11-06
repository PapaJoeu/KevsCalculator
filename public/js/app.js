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
const MM_PER_INCH = 25.4;
const clampToZero = (v) => Math.max(0, v);
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const inchesToMillimeters = (inches, p = 3) => Number((inches * MM_PER_INCH).toFixed(p));
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
  const layW = clampToZero(effW - m.left - m.right);
  const layH = clampToZero(effH - m.top - m.bottom);
  return {
    sheet: { rawWidth: sw, rawHeight: sh, nonPrintable: np, effectiveWidth: effW, effectiveHeight: effH },
    document: { width: dw, height: dh },
    gutter: { horizontal: gh, vertical: gv },
    margins: m,
    layoutArea: { width: layW, height: layH, originX: np.left + m.left, originY: np.top + m.top },
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
  return {
    sheet,
    margins,
    document,
    gutter,
    layoutArea,
    counts: { across: maxAcross, down: maxDown },
    usage: { horizontal: h, vertical: v },
    realizedMargins: {
      left: margins.left,
      top: margins.top,
      right: margins.right + h.trailingMargin,
      bottom: margins.bottom + v.trailingMargin,
    },
  };
}

function applyCountOverrides(layout, desiredAcross, desiredDown) {
  const across = Math.min(layout.counts.across, desiredAcross ?? layout.counts.across);
  const down = Math.min(layout.counts.down, desiredDown ?? layout.counts.down);
  const h = calculateAxisUsage(layout.layoutArea.width, layout.document.width, layout.gutter.horizontal, across);
  const v = calculateAxisUsage(layout.layoutArea.height, layout.document.height, layout.gutter.vertical, down);
  return {
    ...layout,
    counts: { across, down },
    usage: { horizontal: h, vertical: v },
    realizedMargins: {
      left: layout.margins.left,
      top: layout.margins.top,
      right: layout.margins.right + h.trailingMargin,
      bottom: layout.margins.bottom + v.trailingMargin,
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

function calculateFinishing(layout, scoreOptions = {}) {
  const { layoutArea, counts, document, gutter } = layout;
  const hEdges = generateEdgePositions(layoutArea.originY, document.height, gutter.vertical, counts.down);
  const vEdges = generateEdgePositions(layoutArea.originX, document.width, gutter.horizontal, counts.across);
  const hScores = generateScorePositions(layoutArea.originY, document.height, gutter.vertical, counts.down, scoreOptions.horizontalOffsets);
  const vScores = generateScorePositions(layoutArea.originX, document.width, gutter.horizontal, counts.across, scoreOptions.verticalOffsets);
  return {
    cuts: mapPositionsToReadout("Cut", hEdges),
    slits: mapPositionsToReadout("Slit", vEdges),
    scores: {
      horizontal: mapPositionsToReadout("Score", hScores),
      vertical: mapPositionsToReadout("Score", vScores),
    },
  };
}

// ------------------------------------------------------------
// 2. UI utilities
// ------------------------------------------------------------
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const layerVisibility = {
  layout: true,
  docs: true,
  cuts: true,
  scores: true,
};

const selectedMeasurements = new Set();
let currentMeasurementIds = new Set();

const createMeasurementId = (type, index) => `${type}-${index}`;

function registerMeasurementId(id) {
  if (!id) return;
  currentMeasurementIds.add(id);
}

const measurementElements = (id) => $$(`[data-measure-id="${id}"]`);

function setMeasurementHover(id, hovered) {
  measurementElements(id).forEach((el) => el.classList.toggle('is-hovered', hovered));
}

function setMeasurementSelectionClass(id, selected) {
  measurementElements(id).forEach((el) => el.classList.toggle('is-selected', selected));
}

function toggleMeasurementSelection(id) {
  if (!id) return;
  const willSelect = !selectedMeasurements.has(id);
  if (willSelect) {
    selectedMeasurements.add(id);
  } else {
    selectedMeasurements.delete(id);
  }
  setMeasurementSelectionClass(id, willSelect);
}

function attachMeasurementRowInteractions(row) {
  if (!row) return;
  const id = row.dataset.measureId;
  if (!id) return;
  row.setAttribute('tabindex', '0');
  row.addEventListener('mouseenter', () => setMeasurementHover(id, true));
  row.addEventListener('mouseleave', () => setMeasurementHover(id, false));
  row.addEventListener('click', () => toggleMeasurementSelection(id));
  row.addEventListener('focus', () => setMeasurementHover(id, true));
  row.addEventListener('blur', () => setMeasurementHover(id, false));
  row.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      toggleMeasurementSelection(id);
    }
  });
}

function restoreMeasurementSelections() {
  const stale = [];
  selectedMeasurements.forEach((id) => {
    if (!currentMeasurementIds.has(id)) {
      stale.push(id);
      return;
    }
    setMeasurementSelectionClass(id, true);
  });
  stale.forEach((id) => selectedMeasurements.delete(id));
}

function applyLayerVisibility() {
  const svg = $("#svg");
  if (!svg) return;
  Object.entries(layerVisibility).forEach(([layer, visible]) => {
    svg.querySelectorAll(`[data-layer="${layer}"]`).forEach((el) => {
      el.style.display = visible ? "" : "none";
    });
  });
}

function setLayerVisibility(layer, visible) {
  if (!(layer in layerVisibility)) return;
  layerVisibility[layer] = Boolean(visible);
  applyLayerVisibility();
}
const readNumber = (id) => {
  const v = $(id).value;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const readIntOptional = (id) => {
  const raw = ($(id).value || "").trim();
  if (raw === "") return null;
  const n = Math.max(1, Math.floor(Number(raw)));
  return Number.isFinite(n) ? n : null;
};
const parseOffsets = (s) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
const fmtIn = (inches) => `${inches.toFixed(3)} in / ${inchesToMillimeters(inches).toFixed(2)} mm`;

const marginInputSelectors = ["#mTop", "#mRight", "#mBottom", "#mLeft"];
let autoMarginMode = true;

function setAutoMarginMode(enabled) {
  autoMarginMode = Boolean(enabled);
  marginInputSelectors.forEach((selector) => {
    const el = $(selector);
    if (!el) return;
    if (autoMarginMode) {
      el.dataset.auto = "true";
    } else {
      delete el.dataset.auto;
    }
  });
}

function currentInputs() {
  const units = $("#units").value;
  const u = (v) => (units === "mm" ? (Number(v) || 0) / MM_PER_INCH : Number(v) || 0);
  const autoMargins = autoMarginMode;
  const rawMargins = {
    top: u(readNumber("#mTop")),
    right: u(readNumber("#mRight")),
    bottom: u(readNumber("#mBottom")),
    left: u(readNumber("#mLeft")),
  };
  return {
    units,
    sheet: { width: u(readNumber("#sheetW")), height: u(readNumber("#sheetH")) },
    document: { width: u(readNumber("#docW")), height: u(readNumber("#docH")) },
    gutter: { horizontal: u(readNumber("#gutH")), vertical: u(readNumber("#gutV")) },
    margins: autoMargins ? { top: 0, right: 0, bottom: 0, left: 0 } : rawMargins,
    nonPrintable: {
      top: u(readNumber("#npTop")),
      right: u(readNumber("#npRight")),
      bottom: u(readNumber("#npBottom")),
      left: u(readNumber("#npLeft")),
    },
    scoreV: parseOffsets($("#scoresV")?.value || ""),
    scoreH: parseOffsets($("#scoresH")?.value || ""),
    forceAcross: readIntOptional("#forceAcross"),
    forceDown: readIntOptional("#forceDown"),
    autoMargins,
  };
}

const convertForUnits = (value, units) => (units === "mm" ? (value * MM_PER_INCH).toFixed(2) : value);
const describePresetValue = (value, units) => (units === "mm" ? (value * MM_PER_INCH).toFixed(2) : value.toString());

function setSheetPreset(w, h) {
  const units = $("#units").value;
  const width = convertForUnits(w, units);
  const height = convertForUnits(h, units);
  $("#sheetW").value = width;
  $("#sheetH").value = height;
  status(`Sheet preset ${describePresetValue(w, units)}×${describePresetValue(h, units)} ${units}`);
}

function setDocumentPreset(w, h) {
  const units = $("#units").value;
  const width = convertForUnits(w, units);
  const height = convertForUnits(h, units);
  $("#docW").value = width;
  $("#docH").value = height;
  status(`Document preset ${describePresetValue(w, units)}×${describePresetValue(h, units)} ${units}`);
}

function setGutterPreset(horizontal, vertical) {
  const units = $("#units").value;
  const h = convertForUnits(horizontal, units);
  const v = convertForUnits(vertical, units);
  $("#gutH").value = h;
  $("#gutV").value = v;
  status(`Gutter preset ${describePresetValue(horizontal, units)}×${describePresetValue(vertical, units)} ${units}`);
}

function status(txt) {
  $("#status").textContent = txt;
}

function fillTable(tbody, rows, type = 'measure') {
  if (!tbody) return;
  tbody.innerHTML = rows
    .map((r, index) => {
      const id = createMeasurementId(type, index);
      registerMeasurementId(id);
      return `<tr class="measurement-row" data-measure-id="${id}" data-measure-type="${type}" data-measure-index="${index}"><td>${r.label}</td><td class="k">${r.inches.toFixed(3)}</td><td class="k">${r.millimeters.toFixed(2)}</td></tr>`;
    })
    .join("");
  tbody.querySelectorAll('tr[data-measure-id]').forEach((row) => {
    attachMeasurementRowInteractions(row);
    if (selectedMeasurements.has(row.dataset.measureId)) {
      row.classList.add('is-selected');
    }
  });
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
    const leftRight = clampToZero((effW - usedW) / 2),
      topBottom = clampToZero((effH - usedH) / 2);
    ctx = createCalculationContext({
      sheet: { width: ctx.sheet.rawWidth, height: ctx.sheet.rawHeight },
      document: ctx.document,
      gutter: ctx.gutter,
      margins: { top: topBottom, right: leftRight, bottom: topBottom, left: leftRight },
      nonPrintable: ctx.sheet.nonPrintable,
    });
    layout = calculateLayout(ctx);
    layout = applyCountOverrides(layout, inp.forceAcross, inp.forceDown);
    const f = (inches) => (inp.units === "mm" ? (inches * MM_PER_INCH).toFixed(3) : inches.toFixed(3));
    $("#mTop").value = f(topBottom);
    $("#mRight").value = f(leftRight);
    $("#mBottom").value = f(topBottom);
    $("#mLeft").value = f(leftRight);
  }

  currentMeasurementIds = new Set();
  const fin = calculateFinishing(layout, { horizontalOffsets: inp.scoreH, verticalOffsets: inp.scoreV });

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
  const applyLayerAttributes = (el, layer) => {
    if (!layer) return;
    el.dataset.layer = layer;
    el.setAttribute("class", `layer layer-${layer}`);
  };
  const R = (x, y, w, h, { stroke = "#26323e", fill = "none", layer } = {}) => {
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", offX + x * s);
    r.setAttribute("y", offY + y * s);
    r.setAttribute("width", Math.max(0.5, w * s));
    r.setAttribute("height", Math.max(0.5, h * s));
    r.setAttribute("fill", fill);
    r.setAttribute("stroke", stroke);
    r.setAttribute("rx", 6);
    applyLayerAttributes(r, layer);
    svg.appendChild(r);
  };
  const L = (x1, y1, x2, y2, { stroke = "#22d3ee", width = 1.5, layer, measureId, measureType } = {}) => {
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", offX + x1 * s);
    l.setAttribute("y1", offY + y1 * s);
    l.setAttribute("x2", offX + x2 * s);
    l.setAttribute("y2", offY + y2 * s);
    l.setAttribute("stroke", stroke);
    l.setAttribute("stroke-width", width);
    l.setAttribute("stroke-linecap", "round");
    applyLayerAttributes(l, layer);
    if (measureId) {
      registerMeasurementId(measureId);
      l.dataset.measureId = measureId;
      l.classList.add('measurement-line');
      if (measureType) l.dataset.measureType = measureType;
      if (selectedMeasurements.has(measureId)) {
        l.classList.add('is-selected');
      }
      l.addEventListener('mouseenter', () => setMeasurementHover(measureId, true));
      l.addEventListener('mouseleave', () => setMeasurementHover(measureId, false));
      l.addEventListener('click', () => toggleMeasurementSelection(measureId));
    }
    svg.appendChild(l);
  };
  R(0, 0, layout.sheet.rawWidth, layout.sheet.rawHeight, { stroke: "#334155" });
  R(layout.layoutArea.originX, layout.layoutArea.originY, layout.layoutArea.width, layout.layoutArea.height, {
    stroke: "#26323e",
    layer: "layout",
  });
  const across = layout.counts.across,
    down = layout.counts.down;
  for (let y = 0; y < down; y++) {
    for (let x = 0; x < across; x++) {
      const dx = layout.layoutArea.originX + x * (layout.document.width + layout.gutter.horizontal);
      const dy = layout.layoutArea.originY + y * (layout.document.height + layout.gutter.vertical);
      R(dx, dy, layout.document.width, layout.document.height, {
        stroke: "#475569",
        fill: "#64748b33",
        layer: "docs",
      });
    }
  }
  fin.cuts.forEach((c, index) =>
    L(layout.layoutArea.originX, c.inches, layout.layoutArea.originX + layout.layoutArea.width, c.inches, {
      stroke: "#22d3ee",
      width: 1,
      layer: "cuts",
      measureId: createMeasurementId('cut', index),
      measureType: 'cut',
    })
  );
  fin.slits.forEach((s, index) =>
    L(s.inches, layout.layoutArea.originY, s.inches, layout.layoutArea.originY + layout.layoutArea.height, {
      stroke: "#22d3ee",
      width: 1,
      layer: "cuts",
      measureId: createMeasurementId('slit', index),
      measureType: 'slit',
    })
  );
  fin.scores.horizontal.forEach((sc, index) =>
    L(layout.layoutArea.originX, sc.inches, layout.layoutArea.originX + layout.layoutArea.width, sc.inches, {
      stroke: "#a78bfa",
      width: 1,
      layer: "scores",
      measureId: createMeasurementId('score-horizontal', index),
      measureType: 'score-horizontal',
    })
  );
  fin.scores.vertical.forEach((sc, index) =>
    L(sc.inches, layout.layoutArea.originY, sc.inches, layout.layoutArea.originY + layout.layoutArea.height, {
      stroke: "#a78bfa",
      width: 1,
      layer: "scores",
      measureId: createMeasurementId('score-vertical', index),
      measureType: 'score-vertical',
    })
  );
  applyLayerVisibility();
  restoreMeasurementSelections();
}

// ------------------------------------------------------------
// 4. Event bindings
// ------------------------------------------------------------
$$('.tab').forEach((t) =>
  t.addEventListener('click', () => {
    $$('.tab').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    const target = t.dataset.tab;
    $$('.tabpanes>section').forEach((s) => s.classList.remove('active'));
    document.querySelector(`#tab-${target}`).classList.add('active');
  })
);

$$('.layer-toggle').forEach((input) => {
  const layer = input.dataset.layer;
  if (!layer) return;
  const initial = layerVisibility[layer] ?? true;
  input.checked = initial;
  setLayerVisibility(layer, initial);
  input.addEventListener('change', (e) => {
    setLayerVisibility(layer, e.target.checked);
  });
});

$('#sheet-1218').addEventListener('click', () => setSheetPreset(12, 18));
$('#sheet-1319').addEventListener('click', () => setSheetPreset(13, 19));
$('#doc-35x2').addEventListener('click', () => setDocumentPreset(3.5, 2));
$('#doc-8511').addEventListener('click', () => setDocumentPreset(8.5, 11));
$('#doc-55x85').addEventListener('click', () => setDocumentPreset(5.5, 8.5));
$('#doc-35x4').addEventListener('click', () => setDocumentPreset(3.5, 4));
$('#gut-none').addEventListener('click', () => setGutterPreset(0, 0));
$('#gut-eighth').addEventListener('click', () => setGutterPreset(0.125, 0.125));
$('#gut-3125x67').addEventListener('click', () => setGutterPreset(0.3125, 0.67));
$('#gut-1inch').addEventListener('click', () => setGutterPreset(1, 1));

const verticalScorePresetButtons = {
  bifold: $('#scorePresetBifold'),
  trifold: $('#scorePresetTrifold'),
  custom: $('#scorePresetCustom'),
};
const horizontalScorePresetButtons = {
  bifold: $('#scorePresetHBifold'),
  trifold: $('#scorePresetHTrifold'),
  custom: $('#scorePresetHCustom'),
};
const verticalScoreInput = $('#scoresV');
const horizontalScoreInput = $('#scoresH');
const SCORE_PRESETS = {
  bifold: [0.5],
  trifold: [1 / 3, 2 / 3],
};

const formatScoreOffset = (value) => {
  const fixed = Number(value || 0).toFixed(4);
  const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
  return trimmed === '' ? '0' : trimmed;
};

function setVerticalScoreOffsets(offsets = []) {
  if (!verticalScoreInput) return;
  if (!Array.isArray(offsets) || offsets.length === 0) {
    verticalScoreInput.value = '';
    return;
  }
  verticalScoreInput.value = offsets.map(formatScoreOffset).join(', ');
}

function lockVerticalScoreInput(lock, presetKey) {
  if (!verticalScoreInput) return;
  if (lock) {
    verticalScoreInput.setAttribute('readonly', 'true');
    verticalScoreInput.classList.add('is-locked');
    if (presetKey) verticalScoreInput.dataset.preset = presetKey;
  } else {
    verticalScoreInput.removeAttribute('readonly');
    verticalScoreInput.classList.remove('is-locked');
    delete verticalScoreInput.dataset.preset;
  }
}

function setHorizontalScoreOffsets(offsets = []) {
  if (!horizontalScoreInput) return;
  if (!Array.isArray(offsets) || offsets.length === 0) {
    horizontalScoreInput.value = '';
    return;
  }
  horizontalScoreInput.value = offsets.map(formatScoreOffset).join(', ');
}

function lockHorizontalScoreInput(lock, presetKey) {
  if (!horizontalScoreInput) return;
  if (lock) {
    horizontalScoreInput.setAttribute('readonly', 'true');
    horizontalScoreInput.classList.add('is-locked');
    if (presetKey) horizontalScoreInput.dataset.preset = presetKey;
  } else {
    horizontalScoreInput.removeAttribute('readonly');
    horizontalScoreInput.classList.remove('is-locked');
    delete horizontalScoreInput.dataset.preset;
  }
}

function setScorePresetState(buttons, activeKey) {
  Object.entries(buttons).forEach(([key, btn]) => {
    if (!btn) return;
    const isActive = key === activeKey;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

const setVerticalPresetState = (key) => setScorePresetState(verticalScorePresetButtons, key);
const setHorizontalPresetState = (key) => setScorePresetState(horizontalScorePresetButtons, key);

verticalScorePresetButtons.bifold?.addEventListener('click', () => {
  setVerticalScoreOffsets(SCORE_PRESETS.bifold);
  lockVerticalScoreInput(true, 'bifold');
  setVerticalPresetState('bifold');
  update();
  status('Vertical bifold score preset applied');
});

verticalScorePresetButtons.trifold?.addEventListener('click', () => {
  setVerticalScoreOffsets(SCORE_PRESETS.trifold);
  lockVerticalScoreInput(true, 'trifold');
  setVerticalPresetState('trifold');
  update();
  status('Vertical trifold score preset applied');
});

verticalScorePresetButtons.custom?.addEventListener('click', () => {
  lockVerticalScoreInput(false);
  setVerticalPresetState('custom');
  verticalScoreInput?.focus();
  update();
  status('Vertical custom score entry enabled');
});

if (verticalScoreInput) {
  ['input', 'change'].forEach((evt) =>
    verticalScoreInput.addEventListener(evt, () => {
      if (verticalScoreInput.readOnly) return;
      setVerticalPresetState('custom');
    })
  );
}

horizontalScorePresetButtons.bifold?.addEventListener('click', () => {
  setHorizontalScoreOffsets(SCORE_PRESETS.bifold);
  lockHorizontalScoreInput(true, 'bifold');
  setHorizontalPresetState('bifold');
  update();
  status('Horizontal bifold score preset applied');
});

horizontalScorePresetButtons.trifold?.addEventListener('click', () => {
  setHorizontalScoreOffsets(SCORE_PRESETS.trifold);
  lockHorizontalScoreInput(true, 'trifold');
  setHorizontalPresetState('trifold');
  update();
  status('Horizontal trifold score preset applied');
});

horizontalScorePresetButtons.custom?.addEventListener('click', () => {
  lockHorizontalScoreInput(false);
  setHorizontalPresetState('custom');
  horizontalScoreInput?.focus();
  update();
  status('Horizontal custom score entry enabled');
});

if (horizontalScoreInput) {
  ['input', 'change'].forEach((evt) =>
    horizontalScoreInput.addEventListener(evt, () => {
      if (horizontalScoreInput.readOnly) return;
      setHorizontalPresetState('custom');
    })
  );
}

setVerticalPresetState('custom');
setHorizontalPresetState('custom');
const UNIT_PRECISION = { in: 3, mm: 2 };
const numericInputSelectors = [
  '#sheetW',
  '#sheetH',
  '#docW',
  '#docH',
  '#gutH',
  '#gutV',
  ...marginInputSelectors,
  '#npTop',
  '#npRight',
  '#npBottom',
  '#npLeft',
];

marginInputSelectors.forEach((selector) => {
  const el = $(selector);
  if (!el) return;
  ['input', 'change'].forEach((evt) =>
    el.addEventListener(evt, () => {
      if (!autoMarginMode) return;
      setAutoMarginMode(false);
    })
  );
});

setAutoMarginMode(autoMarginMode);

function convertInputs(fromUnits, toUnits) {
  if (fromUnits === toUnits) return;
  const factor =
    fromUnits === 'in' && toUnits === 'mm'
      ? MM_PER_INCH
      : fromUnits === 'mm' && toUnits === 'in'
      ? 1 / MM_PER_INCH
      : null;
  if (!factor) return;
  const precision = UNIT_PRECISION[toUnits] ?? 3;
  numericInputSelectors.forEach((selector) => {
    const el = $(selector);
    if (!el) return;
    const raw = el.value;
    if (raw === '' || raw == null) return;
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    const converted = num * factor;
    el.value = converted.toFixed(precision);
  });
}

let currentUnitsSelection = $('#units').value;
$('#units').addEventListener('change', (e) => {
  const nextUnits = e.target.value;
  convertInputs(currentUnitsSelection, nextUnits);
  currentUnitsSelection = nextUnits;
  status('Units changed');
  update();
});
$('#calcBtn').addEventListener('click', update);
$('#resetBtn').addEventListener('click', () => location.reload());

$('#applyScores').addEventListener('click', update);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') update();
});

// ------------------------------------------------------------
// 5. Initialization & sanity checks
// ------------------------------------------------------------
(function tests() {
  console.assert(inchesToMillimeters(1) === 25.4, '1 inch should be 25.4 mm');
  console.assert(calculateDocumentCount(10, 2, 0) === 5, '10/2=5 docs');
  const ctx = createCalculationContext({
    sheet: { width: 12, height: 18 },
    document: { width: 3.5, height: 2 },
    gutter: { horizontal: 0.125, vertical: 0.125 },
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    nonPrintable: { top: 0.0625, right: 0.0625, bottom: 0.0625, left: 0.0625 },
  });
  const layout = calculateLayout(ctx);
  console.assert(layout.counts.across >= 1 && layout.counts.down >= 1, 'Counts should be >=1 with defaults');
})();

update();
