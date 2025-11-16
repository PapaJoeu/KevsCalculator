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
const CALCULATOR_TABLIST_SELECTOR = '[data-calculator-tabs]';
const CALCULATOR_TAB_SELECTOR = '[data-calculator-tab]';
const CALCULATOR_PANEL_SELECTOR = '[data-calculator-panel]';
const PRESET_BUTTON_SELECTOR = '[data-preset-input][data-preset-value]';

let isInitialized = false;
let autoNUp = 1;
let pendingAutoNUp = null;
let calculatorTabsInitialized = false;
let presetButtonsInitialized = false;

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

/**
 * Configures the in-tab calculator navigation so users can switch between tools with
 * either the mouse or keyboard. The markup mirrors a lightweight tablist, so we only
 * need to orchestrate aria-selected, tabindex, and panel visibility.
 */
function initializeCalculatorTabs() {
  if (calculatorTabsInitialized) {
    return;
  }
  const tablist = $(CALCULATOR_TABLIST_SELECTOR);
  if (!tablist) {
    return;
  }
  const tabs = Array.from(tablist.querySelectorAll(CALCULATOR_TAB_SELECTOR));
  const panels = $$(CALCULATOR_PANEL_SELECTOR);
  if (tabs.length === 0 || panels.length === 0) {
    return;
  }
  // Safely resolve the tab trigger even when events originate from nested spans/text nodes.
  const resolveTargetFromEvent = (eventTarget) => {
    if (!(eventTarget instanceof Element)) {
      return null;
    }
    return eventTarget.closest(CALCULATOR_TAB_SELECTOR);
  };
  const activateTab = (nextTab, { focus } = { focus: false }) => {
    if (!nextTab) {
      return;
    }
    const targetKey = nextTab.dataset.calculatorTab;
    tabs.forEach((tab) => {
      const isActive = tab === nextTab;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });
    panels.forEach((panel) => {
      const isMatch = panel.dataset.calculatorPanel === targetKey;
      panel.classList.toggle('is-active', isMatch);
      panel.hidden = !isMatch;
    });
    if (focus) {
      nextTab.focus();
    }
  };
  const focusableTabs = () => tabs.filter((tab) => !tab.disabled);
  tablist.addEventListener('click', (event) => {
    const target = resolveTargetFromEvent(event.target);
    if (!target || target.disabled) {
      return;
    }
    activateTab(target, { focus: true });
  });
  tablist.addEventListener('keydown', (event) => {
    const currentTab = resolveTargetFromEvent(event.target);
    if (!currentTab) {
      return;
    }
    const enabledTabs = focusableTabs();
    const currentIndex = enabledTabs.indexOf(currentTab);
    if (currentIndex === -1) {
      return;
    }
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      nextIndex = (currentIndex + 1) % enabledTabs.length;
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = enabledTabs.length - 1;
    } else {
      return;
    }
    activateTab(enabledTabs[nextIndex], { focus: true });
  });
  const defaultTab = tabs.find((tab) => tab.classList.contains('is-active')) || tabs[0];
  activateTab(defaultTab);
  calculatorTabsInitialized = true;
}

/**
 * Wires up the preset buttons so the most common pad sizes, counts, and overage targets
 * can be applied with a single click/tap. Dispatching an input event keeps the existing
 * calculator observers in sync.
 */
function initializePresetButtons() {
  if (presetButtonsInitialized) {
    return;
  }
  const buttons = $$(PRESET_BUTTON_SELECTOR);
  if (buttons.length === 0) {
    return;
  }
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const inputId = button.dataset.presetInput;
      const presetValue = button.dataset.presetValue ?? '';
      if (!inputId) {
        return;
      }
      const input = document.getElementById(inputId);
      if (!input) {
        return;
      }
      input.value = presetValue;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
  });
  presetButtonsInitialized = true;
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
  initializeCalculatorTabs();
  initializePresetButtons();
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
