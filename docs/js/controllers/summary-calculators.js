import { $, $$ } from '../utils/dom.js';

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
const TAB_SELECTOR = '.summary-calculator-tab';
const PANEL_SELECTOR = '.summary-calculator__panel';
const QUICK_PICK_SELECTOR = '.summary-calculator__quick-pick';

let isInitialized = false;
let autoNUp = 1;
let pendingAutoNUp = null;
let activeCalculator = null;

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

const readNumberFromInput = (selector) => {
  const el = $(selector);
  if (!el) return Number.NaN;
  const raw = el.value;
  if (raw === '') return Number.NaN;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const readInteger = (selector, { min = 0, fallback = 0 } = {}) => {
  const parsed = readNumberFromInput(selector);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const floored = Math.floor(parsed);
  return Math.max(min, floored);
};

const readFloat = (selector, { min = 0, fallback = 0 } = {}) => {
  const parsed = readNumberFromInput(selector);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, parsed);
};

const readNUp = (selector) => {
  const value = readInteger(selector, { min: 0, fallback: autoNUp });
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
  const padCount = readInteger('#padCount', { min: 0, fallback: 0 });
  const sheetsPerPad = readInteger('#padSheets', { min: 0, fallback: 0 });
  const nUp = readNUp('#padNUp');
  if (padCount <= 0 || sheetsPerPad <= 0 || nUp <= 0) {
    setText('#padTotalPieces', '—');
    setText('#padTotalSheets', '—');
    setText('#padRemainder', '—');
    return;
  }

  const totalPieces = padCount * sheetsPerPad;
  const totalSheets = Math.ceil(totalPieces / nUp);
  const overagePieces = Math.max(0, totalSheets * nUp - totalPieces);

  setText('#padTotalPieces', formatNumber(totalPieces));
  setText('#padTotalSheets', formatNumber(totalSheets));
  setText('#padRemainder', overagePieces > 0 ? `${formatNumber(overagePieces)} pieces` : 'None');
};

const updateRunPlanner = () => {
  const desiredPieces = readInteger('#runDesired', { min: 0, fallback: 0 });
  const nUp = readNUp('#runNUp');
  const oversPercent = readFloat('#runOvers', { min: 0, fallback: 0 });

  if (desiredPieces <= 0 || nUp <= 0) {
    setText('#runTotalPieces', '—');
    setText('#runTotalSheets', '—');
    setText('#runOversBreakdown', '—');
    return;
  }

  const oversPieces = Math.ceil((desiredPieces * oversPercent) / 100);
  const totalPieces = desiredPieces + oversPieces;
  const baseSheets = Math.ceil(desiredPieces / nUp);
  const totalSheets = Math.ceil(totalPieces / nUp);
  const oversSheets = Math.max(0, totalSheets - baseSheets);

  setText('#runTotalPieces', formatNumber(totalPieces));
  setText('#runTotalSheets', formatNumber(totalSheets));
  setText('#runOversBreakdown', formatPiecesWithSheets(oversPieces, oversSheets));
};

const updateSheetsConverter = () => {
  const sheetsToRun = readInteger('#sheetRun', { min: 0, fallback: 0 });
  const nUp = readNUp('#sheetNUp');
  const piecesPerPad = readInteger('#sheetPerPad', { min: 0, fallback: 0 });

  if (sheetsToRun <= 0 || nUp <= 0) {
    setText('#sheetTotalPieces', '—');
    setText('#sheetTotalPads', '—');
    setText('#sheetPadRemainder', '—');
    return;
  }

  const totalPieces = sheetsToRun * nUp;
  const completePads = piecesPerPad > 0 ? Math.floor(totalPieces / piecesPerPad) : 0;
  const remainderPieces = piecesPerPad > 0 ? totalPieces % piecesPerPad : totalPieces;

  setText('#sheetTotalPieces', formatNumber(totalPieces));
  setText('#sheetTotalPads', piecesPerPad > 0 ? formatNumber(completePads) : '—');
  if (piecesPerPad > 0) {
    setText('#sheetPadRemainder', remainderPieces > 0 ? `${formatNumber(remainderPieces)} pieces` : 'None');
  } else {
    setText('#sheetPadRemainder', '—');
  }
};

const recalcAll = () => {
  updatePadCalculator();
  updateRunPlanner();
  updateSheetsConverter();
};

const activateCalculator = (calculatorId) => {
  if (!calculatorId) {
    return;
  }
  activeCalculator = calculatorId;
  $$(TAB_SELECTOR).forEach((tab) => {
    const isActive = tab.dataset.calculatorTab === calculatorId;
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.tabIndex = isActive ? 0 : -1;
  });
  $$(PANEL_SELECTOR).forEach((panel) => {
    const isActive = panel.dataset.calculatorPanel === calculatorId;
    panel.hidden = !isActive;
  });
};

const bindCalculatorTabs = () => {
  const tabs = $$(TAB_SELECTOR);
  if (!tabs.length) {
    return;
  }
  const defaultTab = tabs.find((tab) => tab.dataset.default === 'true');
  activateCalculator(defaultTab?.dataset.calculatorTab || tabs[0].dataset.calculatorTab);
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      const calculatorId = tab.dataset.calculatorTab;
      activateCalculator(calculatorId);
      tab.focus();
    });
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        return;
      }
      event.preventDefault();
      const lastIndex = tabs.length - 1;
      let nextIndex = index;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        nextIndex = index === lastIndex ? 0 : index + 1;
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        nextIndex = index === 0 ? lastIndex : index - 1;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = lastIndex;
      }
      const nextTab = tabs[nextIndex];
      if (nextTab) {
        activateCalculator(nextTab.dataset.calculatorTab);
        nextTab.focus();
      }
    });
  });
};

const bindQuickPickButtons = () => {
  $$(QUICK_PICK_SELECTOR).forEach((button) => {
    button.addEventListener('click', () => {
      const selector = button.dataset.target;
      if (!selector) return;
      const input = $(selector);
      if (!input) return;
      input.value = button.dataset.value ?? '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
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
  bindCalculatorTabs();
  bindQuickPickButtons();
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
