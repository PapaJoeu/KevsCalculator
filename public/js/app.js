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
  const out = [];
  const g = clampToZero(gutterSpan);
  for (let i = 0; i < docCount; i++) {
    const lead = startOffset + i * (docSpan + g);
    const trail = lead + docSpan;
    out.push(lead, trail);
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
const isEmpty = (id) => (($(id).value ?? "").toString().trim() === "");
const parseOffsets = (s) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
const fmtIn = (inches) => `${inches.toFixed(3)} in / ${inchesToMillimeters(inches).toFixed(2)} mm`;

function currentInputs() {
  const units = $("#units").value;
  const u = (v) => (units === "mm" ? (Number(v) || 0) / MM_PER_INCH : Number(v) || 0);
  const autoMargins = isEmpty("#mTop") && isEmpty("#mRight") && isEmpty("#mBottom") && isEmpty("#mLeft");
  return {
    units,
    sheet: { width: u(readNumber("#sheetW")), height: u(readNumber("#sheetH")) },
    document: { width: u(readNumber("#docW")), height: u(readNumber("#docH")) },
    gutter: { horizontal: u(readNumber("#gutH")), vertical: u(readNumber("#gutV")) },
    margins: autoMargins
      ? { top: 0, right: 0, bottom: 0, left: 0 }
      : {
          top: u(readNumber("#mTop")),
          right: u(readNumber("#mRight")),
          bottom: u(readNumber("#mBottom")),
          left: u(readNumber("#mLeft")),
        },
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

function setPreset(w, h) {
  const units = $("#units").value;
  if (units === "mm") {
    w = (w * MM_PER_INCH).toFixed(2);
    h = (h * MM_PER_INCH).toFixed(2);
  }
  $("#sheetW").value = w;
  $("#sheetH").value = h;
  status(`Preset ${w}×${h} ${units}`);
}

function status(txt) {
  $("#status").textContent = txt;
}

function fillTable(tbody, rows) {
  tbody.innerHTML = rows
    .map((r) => `<tr><td>${r.label}</td><td class="k">${r.inches.toFixed(3)}</td><td class="k">${r.millimeters.toFixed(2)}</td></tr>`)
    .join("");
}

// ------------------------------------------------------------
// 3. Rendering + state updates
// ------------------------------------------------------------
function update() {
  const inp = currentInputs();
  let ctx = createCalculationContext(inp);
  let layout = calculateLayout(ctx);
  layout = applyCountOverrides(layout, inp.forceAcross, inp.forceDown);

  // Auto-center margins if blank
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

  fillTable($("#tblCuts tbody"), fin.cuts);
  fillTable($("#tblSlits tbody"), fin.slits);
  fillTable($("#tblScoresH tbody"), fin.scores.horizontal);
  fillTable($("#tblScoresV tbody"), fin.scores.vertical);

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
  const R = (x, y, w, h, cls, stroke = "#26323e") => {
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", offX + x * s);
    r.setAttribute("y", offY + y * s);
    r.setAttribute("width", Math.max(0.5, w * s));
    r.setAttribute("height", Math.max(0.5, h * s));
    r.setAttribute("fill", cls === "docs" ? "#64748b33" : "none");
    r.setAttribute("stroke", stroke);
    r.setAttribute("rx", 6);
    svg.appendChild(r);
  };
  const L = (x1, y1, x2, y2, stroke, width = 1.5) => {
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", offX + x1 * s);
    l.setAttribute("y1", offY + y1 * s);
    l.setAttribute("x2", offX + x2 * s);
    l.setAttribute("y2", offY + y2 * s);
    l.setAttribute("stroke", stroke);
    l.setAttribute("stroke-width", width);
    svg.appendChild(l);
  };
  R(0, 0, layout.sheet.rawWidth, layout.sheet.rawHeight, "sheet", "#334155");
  R(layout.layoutArea.originX, layout.layoutArea.originY, layout.layoutArea.width, layout.layoutArea.height, "layout", "#26323e");
  const across = layout.counts.across,
    down = layout.counts.down;
  for (let y = 0; y < down; y++) {
    for (let x = 0; x < across; x++) {
      const dx = layout.layoutArea.originX + x * (layout.document.width + layout.gutter.horizontal);
      const dy = layout.layoutArea.originY + y * (layout.document.height + layout.gutter.vertical);
      R(dx, dy, layout.document.width, layout.document.height, "docs", "#475569");
    }
  }
  fin.cuts.forEach((c) => L(layout.layoutArea.originX, c.inches, layout.layoutArea.originX + layout.layoutArea.width, c.inches, "#22d3ee", 1));
  fin.slits.forEach((s) => L(s.inches, layout.layoutArea.originY, s.inches, layout.layoutArea.originY + layout.layoutArea.height, "#22d3ee", 1));
  fin.scores.horizontal.forEach((sc) => L(layout.layoutArea.originX, sc.inches, layout.layoutArea.originX + layout.layoutArea.width, sc.inches, "#a78bfa", 1));
  fin.scores.vertical.forEach((sc) => L(sc.inches, layout.layoutArea.originY, sc.inches, layout.layoutArea.originY + layout.layoutArea.height, "#a78bfa", 1));
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

$('#preset-letter').addEventListener('click', () => setPreset(8.5, 11));
$('#preset-1218').addEventListener('click', () => setPreset(12, 18));
$('#swap-wh').addEventListener('click', () => {
  const w = $('#docW').value,
    h = $('#docH').value;
  $('#docW').value = h;
  $('#docH').value = w;
  update();
});
const UNIT_PRECISION = { in: 3, mm: 2 };
const numericInputSelectors = [
  '#sheetW',
  '#sheetH',
  '#docW',
  '#docH',
  '#gutH',
  '#gutV',
  '#mTop',
  '#mRight',
  '#mBottom',
  '#mLeft',
  '#npTop',
  '#npRight',
  '#npBottom',
  '#npLeft',
];

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

function withPageSize(wIn, hIn) {
  const id = 'page-size-style';
  let tag = document.getElementById(id);
  if (!tag) {
    tag = document.createElement('style');
    tag.id = id;
    document.head.appendChild(tag);
  }
  tag.textContent = `@page{ size: ${wIn}in ${hIn}in; margin: 12mm; }`;
}
$('#btnPrintLetter').addEventListener('click', () => {
  withPageSize(8.5, 11);
  window.print();
});
$('#btnPrint1218').addEventListener('click', () => {
  withPageSize(12, 18);
  window.print();
});

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
