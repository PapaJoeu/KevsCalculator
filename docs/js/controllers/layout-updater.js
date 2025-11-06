import { calculateFinishing } from '../calculations/finishing-calculations.js';
import {
  applyCountOverrides,
  calculateLayout,
  createCalculationContext,
} from '../calculations/layout-calculations.js';
import { calculateProgramSequence } from '../utils/program-sequence.js';
import { isAutoMarginModeEnabled } from '../tabs/inputs.js';
import {
  $,
  fillTable,
  fillHoleTable,
  parseOffsets,
  readIntOptional,
  readNumber,
  resetMeasurementRegistry,
} from '../utils/dom.js';
import { updateSummaryCalculators } from './summary-calculators.js';
import {
  MM_PER_INCH,
  clampToZero,
  formatInchesForUnits,
  formatMeasurement,
  inchesToMillimeters,
} from '../utils/units.js';
import { drawSVG } from '../rendering/svg-preview-renderer.js';
import { updatePrintableVisualizer } from '../tabs/print.js';

function updateDocCountField(selector, count) {
  const el = $(selector);
  if (!el) return;
  if (el.dataset.autoActive === 'false') return;
  el.dataset.autoActive = 'true';
  el.dataset.autoValue = String(count);
  el.value = String(count);
}

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
    drilling: readHolePlan(),
    autoMargins,
  };
}

function readHolePlan() {
  const el = $('#holePlanData');
  if (!el) {
    return { preset: 'none', size: 0, entries: [] };
  }
  const raw = el.value;
  if (!raw) {
    return { preset: 'none', size: 0, entries: [] };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { preset: 'none', size: 0, entries: [] };
    }
    const preset = typeof parsed.preset === 'string' ? parsed.preset : 'none';
    const size = Number(parsed.size);
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    return {
      preset,
      size: Number.isFinite(size) ? size : 0,
      entries,
    };
  } catch (error) {
    console.error('Failed to parse hole plan data', error);
    return { preset: 'none', size: 0, entries: [] };
  }
}

export function status(txt) {
  $('#status').textContent = txt;
}

export function update() {
  const inp = currentInputs();
  let ctx = createCalculationContext(inp);
  let layout = calculateLayout(ctx);
  layout = applyCountOverrides(layout, inp.forceAcross, inp.forceDown);

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
    const formatMargin = (inches) => formatInchesForUnits(inches, inp.units);
    $('#mTop').value = formatMargin(topMargin);
    $('#mRight').value = formatMargin(rightMargin);
    $('#mBottom').value = formatMargin(bottomMargin);
    $('#mLeft').value = formatMargin(leftMargin);
  }

  resetMeasurementRegistry();
  const fin = calculateFinishing(layout, {
    scoreHorizontal: inp.scoreH,
    scoreVertical: inp.scoreV,
    perforationHorizontal: inp.perfH,
    perforationVertical: inp.perfV,
    holePlan: inp.drilling,
  });
  const programSequence = calculateProgramSequence(layout);

  updateDocCountField('#forceAcross', layout.counts.across);
  updateDocCountField('#forceDown', layout.counts.down);

  updateSummaryCalculators(layout);

  $('#vAcross').textContent = layout.counts.across;
  $('#vDown').textContent = layout.counts.down;
  $('#vTotal').textContent = layout.counts.across * layout.counts.down;
  const summaryPrecision = inp.units === 'mm' ? 2 : 3;
  const formatSummary = (value) => formatMeasurement(value, inp.units, summaryPrecision);
  $('#vLayout').textContent = `${formatSummary(layout.layoutArea.width)} × ${formatSummary(layout.layoutArea.height)}`;
  $('#vOrigin').textContent = `x ${formatSummary(layout.layoutArea.originX)}, y ${formatSummary(layout.layoutArea.originY)}`;
  $('#vRealMargins').textContent = `L ${formatSummary(layout.realizedMargins.left)}, T ${formatSummary(
    layout.realizedMargins.top
  )}, R ${formatSummary(layout.realizedMargins.right)}, B ${formatSummary(layout.realizedMargins.bottom)}`;
  $('#vUsed').textContent = `${formatSummary(layout.usage.horizontal.usedSpan)} × ${formatSummary(
    layout.usage.vertical.usedSpan
  )}`;
  $('#vTrail').textContent = `${formatSummary(layout.usage.horizontal.trailingMargin)} × ${formatSummary(
    layout.usage.vertical.trailingMargin
  )}`;

  fillTable($('#tblCuts tbody'), fin.cuts, 'cut');
  fillTable($('#tblSlits tbody'), fin.slits, 'slit');
  fillTable($('#tblScoresH tbody'), fin.scores.horizontal, 'score-horizontal');
  fillTable($('#tblScoresV tbody'), fin.scores.vertical, 'score-vertical');
  fillTable($('#tblPerforationsH tbody'), fin.perforations.horizontal, 'perforation-horizontal');
  fillTable($('#tblPerforationsV tbody'), fin.perforations.vertical, 'perforation-vertical');
  fillTable($('#tblProgramSequence tbody'), programSequence, 'program-sequence');
  fillHoleTable($('#tblHoles tbody'), fin.holes ?? []);

  updatePrintableVisualizer({ layout, finishing: fin, context: ctx });

  drawSVG(layout, fin);
  status('Updated');
}
