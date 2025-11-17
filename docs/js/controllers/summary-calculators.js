import { $, $$, readFloatInput, readIntegerInput } from '../utils/dom.js';
import {
  calculatePadTotals,
  calculateRunPlan,
  calculateSheetConversion,
} from '../utils/summary-calculations.js';

const numberFormatter = typeof Intl !== 'undefined' ? new Intl.NumberFormat() : { format: (value) => String(value) };

const AUTO_FILL_SELECTORS = ['#padNUp', '#runNUp', '#sheetNUp'];
const INPUT_SELECTORS = [
  '#padCount',
  '#padSheets',
  '#padNUp',
  '#runDesired',
  '#runNUp',
  '#runOvers',
  '#sheetRun',
  '#sheetNUp',
  '#sheetPerPad',
];

let isInitialized = false;
let autoNUp = 1;
let pendingAutoNUp = null;

const formatNumber = (value) => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return numberFormatter.format(value);
};

const setText = (selector, value) => {
  const el = $(selector);
  if (!el) return;
  el.textContent = value;
};

const readNUp = (selector) => {
  const value = readIntegerInput(selector, { min: 0, fallback: autoNUp });
  if (value > 0) {
    return value;
  }
  return autoNUp > 0 ? autoNUp : 0;
};

const syncAutoFillInputs = () => {
  AUTO_FILL_SELECTORS.forEach((selector) => {
    const input = $(selector);
    if (!input) return;
    if (input.dataset.autofill === 'false') {
      return;
    }
    input.dataset.autofill = 'true';
    input.value = autoNUp > 0 ? String(autoNUp) : '';
  });
};

const markManualIfUserEdited = (event) => {
  const target = event.target;
  if (!target || !AUTO_FILL_SELECTORS.includes(`#${target.id}`)) {
    return;
  }
  target.dataset.autofill = 'false';
};

const formatPiecesWithSheets = (pieces, sheets) => {
  if (pieces <= 0 && sheets <= 0) {
    return 'None';
  }
  const parts = [];
  if (pieces > 0) {
    parts.push(`${formatNumber(pieces)} pieces`);
  }
  if (sheets > 0) {
    parts.push(`${formatNumber(sheets)} sheets`);
  }
  return parts.join(' / ');
};

const updatePadCalculator = () => {
  const padCount = readIntegerInput('#padCount', { min: 0, fallback: 0 });
  const sheetsPerPad = readIntegerInput('#padSheets', { min: 0, fallback: 0 });
  const nUp = readNUp('#padNUp');
  const result = calculatePadTotals({ padCount, sheetsPerPad, nUp });
  if (!result) {
    setText('#padTotalPieces', '—');
    setText('#padTotalSheets', '—');
    setText('#padRemainder', '—');
    return;
  }

  const { totalPieces, totalSheets, overagePieces } = result;

  setText('#padTotalPieces', formatNumber(totalPieces));
  setText('#padTotalSheets', formatNumber(totalSheets));
  setText('#padRemainder', overagePieces > 0 ? `${formatNumber(overagePieces)} pieces` : 'None');
};

const updateRunPlanner = () => {
  const desiredPieces = readIntegerInput('#runDesired', { min: 0, fallback: 0 });
  const nUp = readNUp('#runNUp');
  const oversPercent = readFloatInput('#runOvers', { min: 0, fallback: 0 });

  const result = calculateRunPlan({ desiredPieces, nUp, oversPercent });
  if (!result) {
    setText('#runTotalPieces', '—');
    setText('#runTotalSheets', '—');
    setText('#runOversBreakdown', '—');
    return;
  }

  const { totalPieces, totalSheets, oversPieces, oversSheets } = result;

  setText('#runTotalPieces', formatNumber(totalPieces));
  setText('#runTotalSheets', formatNumber(totalSheets));
  setText('#runOversBreakdown', formatPiecesWithSheets(oversPieces, oversSheets));
};

const updateSheetsConverter = () => {
  const sheetsToRun = readIntegerInput('#sheetRun', { min: 0, fallback: 0 });
  const nUp = readNUp('#sheetNUp');
  const piecesPerPad = readIntegerInput('#sheetPerPad', { min: 0, fallback: 0 });

  const result = calculateSheetConversion({ sheetsToRun, nUp, piecesPerPad });
  if (!result) {
    setText('#sheetTotalPieces', '—');
    setText('#sheetTotalPads', '—');
    setText('#sheetPadRemainder', '—');
    return;
  }

  const { totalPieces, hasPadBreakdown, completePads, remainderPieces } = result;

  setText('#sheetTotalPieces', formatNumber(totalPieces));
  setText('#sheetTotalPads', hasPadBreakdown && completePads !== null ? formatNumber(completePads) : '—');
  if (hasPadBreakdown) {
    setText('#sheetPadRemainder', remainderPieces && remainderPieces > 0 ? `${formatNumber(remainderPieces)} pieces` : 'None');
  } else {
    setText('#sheetPadRemainder', '—');
  }
};

const recalcAll = () => {
  updatePadCalculator();
  updateRunPlanner();
  updateSheetsConverter();
};

function attachEventListeners() {
  INPUT_SELECTORS.forEach((selector) => {
    const input = $(selector);
    if (!input) return;
    if (AUTO_FILL_SELECTORS.includes(selector) && !input.dataset.autofill) {
      input.dataset.autofill = 'true';
    }
    input.addEventListener('input', (event) => {
      markManualIfUserEdited(event);
      recalcAll();
    });
    input.addEventListener('change', (event) => {
      markManualIfUserEdited(event);
      recalcAll();
    });
  });

  $$('.summary-calculator__form').forEach((form) => {
    form.addEventListener('submit', (event) => event.preventDefault());
  });
}

function ensureDefaultValues() {
  const defaultPairs = [
    ['#padSheets', 50],
    ['#sheetPerPad', 50],
  ];
  defaultPairs.forEach(([selector, defaultValue]) => {
    const input = $(selector);
    if (!input) return;
    if (!input.value || Number.isNaN(Number(input.value))) {
      input.value = String(defaultValue);
    }
  });
}

function applyAutoNUp(nextNUp) {
  const sanitized = Number.isFinite(nextNUp) ? Math.max(0, Math.floor(nextNUp)) : 0;
  autoNUp = sanitized;
  if (!isInitialized) {
    pendingAutoNUp = autoNUp;
    return;
  }
  syncAutoFillInputs();
  recalcAll();
}

export function initializeSummaryCalculators() {
  if (isInitialized) {
    return;
  }
  isInitialized = true;
  attachEventListeners();
  ensureDefaultValues();
  syncAutoFillInputs();
  if (pendingAutoNUp !== null) {
    autoNUp = pendingAutoNUp;
    syncAutoFillInputs();
    pendingAutoNUp = null;
  }
  recalcAll();
}

export function updateSummaryCalculators(layout) {
  const counts = layout?.counts;
  const totalNUp = Number.isFinite(counts?.across) && Number.isFinite(counts?.down)
    ? counts.across * counts.down
    : null;
  if (totalNUp === null) {
    return;
  }
  applyAutoNUp(totalNUp);
}
