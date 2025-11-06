import { sheetPresets, documentPresets, gutterPresets } from './input-presets.js';
import { DEFAULT_INPUTS } from './config/defaults.js';

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
    perfV: parseOffsets($("#perfV")?.value || ""),
    perfH: parseOffsets($("#perfH")?.value || ""),
    forceAcross: readIntOptional("#forceAcross"),
    forceDown: readIntOptional("#forceDown"),
    autoMargins,
  };
}

const convertForUnits = (value, units) => (units === "mm" ? (value * MM_PER_INCH).toFixed(2) : value);
const describePresetValue = (value, units) => (units === "mm" ? (value * MM_PER_INCH).toFixed(2) : value.toString());
const formatValueForUnits = (value, units) => {
  if (value == null) return "";
  if (units === "mm") return (value * MM_PER_INCH).toFixed(2);
  if (!Number.isFinite(value)) return "";
  return Number(value.toFixed(4)).toString();
};

const UNIT_TO_SYSTEM = { in: "imperial", mm: "metric" };
const presetSelectionMemory = {
  sheet: { imperial: "", metric: "" },
  document: { imperial: "", metric: "" },
  gutter: { imperial: "", metric: "" },
};

const filterPresetsBySystem = (presets, system) => {
  return presets.filter((preset) => {
    if (!Array.isArray(preset.systems) || preset.systems.length === 0) return true;
    return preset.systems.includes(system);
  });
};

function populatePresetSelect(selectEl, presets, system, memoryKey) {
  if (!selectEl) return;
  const placeholder =
    selectEl.dataset.placeholder ||
    selectEl.querySelector('option[value=""]')?.textContent ||
    "Choose a preset…";
  const filtered = filterPresetsBySystem(presets, system);
  selectEl.innerHTML = "";
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  selectEl.appendChild(placeholderOption);
  filtered.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.label;
    option.dataset.width = preset.width;
    option.dataset.height = preset.height;
    selectEl.appendChild(option);
  });
  selectEl.dataset.placeholder = placeholder;
  const memory = presetSelectionMemory[memoryKey] || {};
  const storedValue = memory[system];
  if (storedValue && filtered.some((preset) => preset.id === storedValue)) {
    selectEl.value = storedValue;
  } else {
    selectEl.value = "";
  }
}

function handlePresetSelect(selectEl, memoryKey, applyPreset) {
  if (!selectEl) return;
  selectEl.addEventListener("change", (event) => {
    const option = event.target.selectedOptions?.[0];
    const units = $("#units").value;
    const system = UNIT_TO_SYSTEM[units] || "imperial";
    const memory = presetSelectionMemory[memoryKey];
    if (memory) {
      memory[system] = event.target.value || "";
    }
    if (!option || !option.value) return;
    const width = Number(option.dataset.width);
    const height = Number(option.dataset.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    applyPreset(width, height);
  });
}

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
      const cells = [
        `<td>${r.label}</td>`,
        `<td class="k">${r.inches.toFixed(3)}</td>`,
        `<td class="k">${r.millimeters.toFixed(2)}</td>`,
      ];
      return `<tr class="measurement-row" data-measure-id="${id}" data-measure-type="${type}" data-measure-index="${index}">${cells.join("")}</tr>`;
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

  currentMeasurementIds = new Set();
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
  fin.scores.horizontal.forEach((sc, index) => {
    const measureId = createMeasurementId('score-horizontal', index);
    L(layout.layoutArea.originX, sc.inches, layout.layoutArea.originX + layout.layoutArea.width, sc.inches, {
      stroke: "#a78bfa",
      width: 1,
      layer: "scores",
      measureId,
      measureType: 'score-horizontal',
    });
  });
  fin.scores.vertical.forEach((sc, index) => {
    const measureId = createMeasurementId('score-vertical', index);
    L(sc.inches, layout.layoutArea.originY, sc.inches, layout.layoutArea.originY + layout.layoutArea.height, {
      stroke: "#a78bfa",
      width: 1,
      layer: "scores",
      measureId,
      measureType: 'score-vertical',
    });
  });
  fin.perforations.horizontal.forEach((pf, index) => {
    const measureId = createMeasurementId('perforation-horizontal', index);
    L(layout.layoutArea.originX, pf.inches, layout.layoutArea.originX + layout.layoutArea.width, pf.inches, {
      stroke: "#f97316",
      width: 1,
      layer: "scores",
      measureId,
      measureType: 'perforation-horizontal',
      perforated: true,
    });
  });
  fin.perforations.vertical.forEach((pf, index) => {
    const measureId = createMeasurementId('perforation-vertical', index);
    L(pf.inches, layout.layoutArea.originY, pf.inches, layout.layoutArea.originY + layout.layoutArea.height, {
      stroke: "#f97316",
      width: 1,
      layer: "scores",
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
const DEFAULT_TAB_KEY = 'inputs';

function activateTab(targetKey = DEFAULT_TAB_KEY) {
  const requestedTab = $(`.output-tab-trigger[data-tab='${targetKey}']`);
  const requestedPane = document.querySelector(`#tab-${targetKey}`);
  const fallbackTab = $(`.output-tab-trigger[data-tab='${DEFAULT_TAB_KEY}']`);
  const fallbackPane = document.querySelector(`#tab-${DEFAULT_TAB_KEY}`);
  const tabToActivate = requestedTab ?? fallbackTab;
  const paneToActivate = requestedPane ?? fallbackPane;
  if (!tabToActivate || !paneToActivate) return;
  $$('.output-tab-trigger').forEach((x) => x.classList.remove('is-active'));
  $$('.output-tabpanel-collection>section').forEach((s) => s.classList.remove('is-active'));
  tabToActivate.classList.add('is-active');
  paneToActivate.classList.add('is-active');
}

$$('.output-tab-trigger').forEach((t) => t.addEventListener('click', () => activateTab(t.dataset.tab)));

const initiallyActiveTab = document.querySelector('.output-tab-trigger.is-active');
activateTab(initiallyActiveTab ? initiallyActiveTab.dataset.tab : DEFAULT_TAB_KEY);

$$('.layer-visibility-toggle-input').forEach((input) => {
  const layer = input.dataset.layer;
  if (!layer) return;
  const initial = layerVisibility[layer] ?? true;
  input.checked = initial;
  setLayerVisibility(layer, initial);
  input.addEventListener('change', (e) => {
    setLayerVisibility(layer, e.target.checked);
  });
});

const sheetPresetSelect = $('#sheetPresetSelect');
const documentPresetSelect = $('#documentPresetSelect');
const gutterPresetSelect = $('#gutterPresetSelect');

const getSystemForUnits = (units) => UNIT_TO_SYSTEM[units] || 'imperial';

const refreshPresetDropdowns = (system) => {
  populatePresetSelect(sheetPresetSelect, sheetPresets, system, 'sheet');
  populatePresetSelect(documentPresetSelect, documentPresets, system, 'document');
  populatePresetSelect(gutterPresetSelect, gutterPresets, system, 'gutter');
};

handlePresetSelect(sheetPresetSelect, 'sheet', setSheetPreset);
handlePresetSelect(documentPresetSelect, 'document', setDocumentPreset);
handlePresetSelect(gutterPresetSelect, 'gutter', setGutterPreset);

$$('[data-layout-preset]').forEach((btn) => {
  const key = btn.dataset.layoutPreset;
  if (!key) return;
  btn.addEventListener('click', () => applyLayoutPreset(key));
});

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

const verticalPerforationPresetButtons = {
  bifold: $('#perfPresetVBifold'),
  trifold: $('#perfPresetVTrifold'),
  custom: $('#perfPresetVCustom'),
};
const horizontalPerforationPresetButtons = {
  bifold: $('#perfPresetHBifold'),
  trifold: $('#perfPresetHTrifold'),
  custom: $('#perfPresetHCustom'),
};
const verticalPerforationInput = $('#perfV');
const horizontalPerforationInput = $('#perfH');
const PERFORATION_PRESETS = {
  bifold: [0.5],
  trifold: [1 / 3, 2 / 3],
};

const formatOffsetValue = (value) => {
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
  verticalScoreInput.value = offsets.map(formatOffsetValue).join(', ');
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
  horizontalScoreInput.value = offsets.map(formatOffsetValue).join(', ');
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

function setVerticalPerforationOffsets(offsets = []) {
  if (!verticalPerforationInput) return;
  if (!Array.isArray(offsets) || offsets.length === 0) {
    verticalPerforationInput.value = '';
    return;
  }
  verticalPerforationInput.value = offsets.map(formatOffsetValue).join(', ');
}

function lockVerticalPerforationInput(lock, presetKey) {
  if (!verticalPerforationInput) return;
  if (lock) {
    verticalPerforationInput.setAttribute('readonly', 'true');
    verticalPerforationInput.classList.add('is-locked');
    if (presetKey) verticalPerforationInput.dataset.preset = presetKey;
  } else {
    verticalPerforationInput.removeAttribute('readonly');
    verticalPerforationInput.classList.remove('is-locked');
    delete verticalPerforationInput.dataset.preset;
  }
}

function setHorizontalPerforationOffsets(offsets = []) {
  if (!horizontalPerforationInput) return;
  if (!Array.isArray(offsets) || offsets.length === 0) {
    horizontalPerforationInput.value = '';
    return;
  }
  horizontalPerforationInput.value = offsets.map(formatOffsetValue).join(', ');
}

function lockHorizontalPerforationInput(lock, presetKey) {
  if (!horizontalPerforationInput) return;
  if (lock) {
    horizontalPerforationInput.setAttribute('readonly', 'true');
    horizontalPerforationInput.classList.add('is-locked');
    if (presetKey) horizontalPerforationInput.dataset.preset = presetKey;
  } else {
    horizontalPerforationInput.removeAttribute('readonly');
    horizontalPerforationInput.classList.remove('is-locked');
    delete horizontalPerforationInput.dataset.preset;
  }
}

const setVerticalPresetState = (key) => setScorePresetState(verticalScorePresetButtons, key);
const setHorizontalPresetState = (key) => setScorePresetState(horizontalScorePresetButtons, key);
const setVerticalPerforationPresetState = (key) =>
  setScorePresetState(verticalPerforationPresetButtons, key);
const setHorizontalPerforationPresetState = (key) =>
  setScorePresetState(horizontalPerforationPresetButtons, key);

function applyLayoutPreset(presetKey) {
  const presets = window.LAYOUT_PRESETS || {};
  const preset = presets[presetKey];
  if (!preset) {
    status(`Unknown layout preset: ${presetKey}`);
    return;
  }
  setAutoMarginMode(true);
  marginInputSelectors.forEach((selector) => {
    const el = $(selector);
    if (el) el.value = '';
  });

  const units = $('#units').value;
  const setValue = (selector, value) => {
    const el = $(selector);
    if (!el || !Number.isFinite(Number(value))) return;
    el.value = formatValueForUnits(Number(value), units);
  };

  setValue('#sheetW', preset.sheet?.width ?? 0);
  setValue('#sheetH', preset.sheet?.height ?? 0);
  setValue('#docW', preset.document?.width ?? 0);
  setValue('#docH', preset.document?.height ?? 0);
  setValue('#gutH', preset.gutter?.horizontal ?? 0);
  setValue('#gutV', preset.gutter?.vertical ?? 0);

  const np = preset.nonPrintable || {};
  setValue('#npTop', np.top ?? 0);
  setValue('#npRight', np.right ?? 0);
  setValue('#npBottom', np.bottom ?? 0);
  setValue('#npLeft', np.left ?? 0);

  lockVerticalScoreInput(false);
  lockHorizontalScoreInput(false);
  setVerticalPresetState('custom');
  setHorizontalPresetState('custom');
  setVerticalScoreOffsets(preset.scores?.vertical ?? []);
  setHorizontalScoreOffsets(preset.scores?.horizontal ?? []);
  lockVerticalPerforationInput(false);
  lockHorizontalPerforationInput(false);
  setVerticalPerforationPresetState('custom');
  setHorizontalPerforationPresetState('custom');
  setVerticalPerforationOffsets(preset.perforations?.vertical ?? []);
  setHorizontalPerforationOffsets(preset.perforations?.horizontal ?? []);

  update();
  status(`${preset.label} preset applied`);
}

function swapScoreOffsets() {
  if (!verticalScoreInput || !horizontalScoreInput) return;
  const verticalOffsets = parseOffsets(verticalScoreInput.value);
  const horizontalOffsets = parseOffsets(horizontalScoreInput.value);

  lockVerticalScoreInput(false);
  lockHorizontalScoreInput(false);
  setVerticalPresetState('custom');
  setHorizontalPresetState('custom');

  setVerticalScoreOffsets(horizontalOffsets);
  setHorizontalScoreOffsets(verticalOffsets);

  update();
  status('Swapped vertical and horizontal score offsets');
}

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

verticalPerforationPresetButtons.bifold?.addEventListener('click', () => {
  setVerticalPerforationOffsets(PERFORATION_PRESETS.bifold);
  lockVerticalPerforationInput(true, 'bifold');
  setVerticalPerforationPresetState('bifold');
  update();
  status('Vertical bifold perforation preset applied');
});

verticalPerforationPresetButtons.trifold?.addEventListener('click', () => {
  setVerticalPerforationOffsets(PERFORATION_PRESETS.trifold);
  lockVerticalPerforationInput(true, 'trifold');
  setVerticalPerforationPresetState('trifold');
  update();
  status('Vertical trifold perforation preset applied');
});

verticalPerforationPresetButtons.custom?.addEventListener('click', () => {
  lockVerticalPerforationInput(false);
  setVerticalPerforationPresetState('custom');
  verticalPerforationInput?.focus();
  update();
  status('Vertical custom perforation entry enabled');
});

if (verticalPerforationInput) {
  ['input', 'change'].forEach((evt) =>
    verticalPerforationInput.addEventListener(evt, () => {
      if (verticalPerforationInput.readOnly) return;
      setVerticalPerforationPresetState('custom');
    })
  );
}

horizontalPerforationPresetButtons.bifold?.addEventListener('click', () => {
  setHorizontalPerforationOffsets(PERFORATION_PRESETS.bifold);
  lockHorizontalPerforationInput(true, 'bifold');
  setHorizontalPerforationPresetState('bifold');
  update();
  status('Horizontal bifold perforation preset applied');
});

horizontalPerforationPresetButtons.trifold?.addEventListener('click', () => {
  setHorizontalPerforationOffsets(PERFORATION_PRESETS.trifold);
  lockHorizontalPerforationInput(true, 'trifold');
  setHorizontalPerforationPresetState('trifold');
  update();
  status('Horizontal trifold perforation preset applied');
});

horizontalPerforationPresetButtons.custom?.addEventListener('click', () => {
  lockHorizontalPerforationInput(false);
  setHorizontalPerforationPresetState('custom');
  horizontalPerforationInput?.focus();
  update();
  status('Horizontal custom perforation entry enabled');
});

if (horizontalPerforationInput) {
  ['input', 'change'].forEach((evt) =>
    horizontalPerforationInput.addEventListener(evt, () => {
      if (horizontalPerforationInput.readOnly) return;
      setHorizontalPerforationPresetState('custom');
    })
  );
}

$('#swapScoreOffsets')?.addEventListener('click', swapScoreOffsets);

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
setVerticalPerforationPresetState('custom');
setHorizontalPerforationPresetState('custom');
const UNIT_PRECISION = { in: 3, mm: 2 };
const trimTrailingZeros = (str) => {
  if (!str.includes('.')) return str;
  const stripped = str.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
  return stripped === '' ? '0' : stripped;
};
const formatUnitValue = (value, precision) => trimTrailingZeros(Number(value || 0).toFixed(precision));
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

function applyNumericInputAttributes(el, units) {
  const targetUnits = units === 'mm' ? 'mm' : 'in';
  const attributes = [
    ['step', el.dataset.inchStep],
    ['min', el.dataset.inchMin],
    ['max', el.dataset.inchMax],
  ];
  attributes.forEach(([attr, baseValue]) => {
    if (baseValue == null || baseValue === '') {
      el.removeAttribute(attr);
      return;
    }
    if (targetUnits === 'in') {
      el.setAttribute(attr, baseValue);
      return;
    }
    const numeric = Number(baseValue);
    if (!Number.isFinite(numeric)) return;
    el.setAttribute(attr, formatUnitValue(numeric * MM_PER_INCH, 4));
  });
}

function applyNumericInputUnits(units) {
  numericInputSelectors.forEach((selector) => {
    const el = $(selector);
    if (!el) return;
    applyNumericInputAttributes(el, units);
  });
}

function convertInputs(fromUnits, toUnits) {
  if (!toUnits) return;
  const precision = UNIT_PRECISION[toUnits] ?? 3;
  if (fromUnits !== toUnits) {
    const factor =
      fromUnits === 'in' && toUnits === 'mm'
        ? MM_PER_INCH
        : fromUnits === 'mm' && toUnits === 'in'
        ? 1 / MM_PER_INCH
        : null;
    if (factor) {
      numericInputSelectors.forEach((selector) => {
        const el = $(selector);
        if (!el) return;
        const raw = el.value;
        if (raw === '' || raw == null) return;
        const num = Number(raw);
        if (!Number.isFinite(num)) return;
        const converted = num * factor;
        el.value = formatUnitValue(converted, precision);
      });
    }
  }
  applyNumericInputUnits(toUnits);
}

let currentUnitsSelection = DEFAULT_INPUTS.units;

function applyDefaultInputs() {
  const { units, sheet, document, gutter, nonPrintable } = DEFAULT_INPUTS;
  const precision = UNIT_PRECISION[units] ?? 3;
  const setValue = (selector, value) => {
    const el = $(selector);
    if (!el) return;
    if (value == null || value === '') {
      el.value = '';
      return;
    }
    el.value = formatUnitValue(value, precision);
  };

  $('#units').value = units;
  currentUnitsSelection = units;
  setAutoMarginMode(true);

  setValue('#sheetW', sheet.width);
  setValue('#sheetH', sheet.height);
  setValue('#docW', document.width);
  setValue('#docH', document.height);
  setValue('#gutH', gutter.horizontal);
  setValue('#gutV', gutter.vertical);
  setValue('#npTop', nonPrintable.top);
  setValue('#npRight', nonPrintable.right);
  setValue('#npBottom', nonPrintable.bottom);
  setValue('#npLeft', nonPrintable.left);

  ['#mTop', '#mRight', '#mBottom', '#mLeft', '#forceAcross', '#forceDown', '#scoresV', '#scoresH', '#perfV', '#perfH'].forEach(
    (selector) => {
      const el = $(selector);
      if (!el) return;
      el.value = '';
    }
  );

  if (sheetPresetSelect) sheetPresetSelect.value = '';
  if (documentPresetSelect) documentPresetSelect.value = '';
  if (gutterPresetSelect) gutterPresetSelect.value = '';

  status('');
  applyNumericInputUnits(units);
}

applyDefaultInputs();
refreshPresetDropdowns(getSystemForUnits(currentUnitsSelection));

$('#units').addEventListener('change', (e) => {
  const nextUnits = e.target.value;
  convertInputs(currentUnitsSelection, nextUnits);
  currentUnitsSelection = nextUnits;
  refreshPresetDropdowns(getSystemForUnits(nextUnits));
  status('Units changed');
  update();
});
$('#calcBtn').addEventListener('click', update);
$('#resetBtn').addEventListener('click', () => {
  applyDefaultInputs();
  refreshPresetDropdowns(getSystemForUnits(currentUnitsSelection));
  update();
});

$('#applyScores').addEventListener('click', update);
$('#applyPerforations').addEventListener('click', update);

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
    sheet: { ...DEFAULT_INPUTS.sheet },
    document: { ...DEFAULT_INPUTS.document },
    gutter: { ...DEFAULT_INPUTS.gutter },
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    nonPrintable: { ...DEFAULT_INPUTS.nonPrintable },
  });
  const layout = calculateLayout(ctx);
  console.assert(layout.counts.across >= 1 && layout.counts.down >= 1, 'Counts should be >=1 with defaults');
  const initialUnits = currentUnitsSelection;
  const alternateUnits = initialUnits === 'in' ? 'mm' : 'in';
  const snapshot = numericInputSelectors
    .map((selector) => {
      const el = $(selector);
      if (!el) return null;
      return { selector, value: el.value, step: el.getAttribute('step') };
    })
    .filter(Boolean);
  convertInputs(initialUnits, alternateUnits);
  convertInputs(alternateUnits, initialUnits);
  const mismatches = snapshot.filter(({ selector, value, step }) => {
    const el = $(selector);
    if (!el) return false;
    return el.value !== value || el.getAttribute('step') !== step;
  });
  console.assert(mismatches.length === 0, 'Unit toggles should preserve numeric values and steps');
})();

update();
