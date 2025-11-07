import { sheetPresets, documentPresets, gutterPresets } from '../data/input-presets.js';
import { DEFAULT_INPUTS } from '../config/defaults.js';
import { $ } from '../utils/dom.js';
import {
  MM_PER_INCH,
  convertForUnits,
  describePresetValue,
  formatUnitsValue,
  getUnitsPrecision,
} from '../utils/units.js';
import { hydrateTabPanel } from './registry.js';

const TAB_KEY = 'inputs';
const marginInputSelectors = ['#mTop', '#mRight', '#mBottom', '#mLeft'];
const docCountSelectors = ['#forceAcross', '#forceDown'];
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

const UNIT_TO_SYSTEM = { in: 'imperial', mm: 'metric' };
const presetSelectionMemory = {
  sheet: { imperial: '', metric: '' },
  document: { imperial: '', metric: '' },
  gutter: { imperial: '', metric: '' },
};

let initialized = false;
let autoMarginMode = true;
let currentUnitsSelection = DEFAULT_INPUTS.units;
let storedContext = { update: () => {}, status: () => {} };
let keydownHandlerAttached = false;

const EAGLE_IMAGE_SRC = 'media/eagle.svg';
const EAGLE_AUDIO_SRC = 'media/eagle.wav';
const EAGLE_CLASS = 'freedom-eagle';
const ALERT_CLASS = 'freedom-alert';
const CELEBRATION_STYLESHEET_URL = './css/celebration.css';
const CELEBRATION_STYLESHEET_ATTR = 'data-optional-celebration';
const CONFETTI_CLASS = 'freedom-confetti';
const CONFETTI_PIECE_CLASS = 'freedom-confetti__piece';
const CONFETTI_COLORS = ['#B22234', '#FFFFFF', '#3C3B6E'];
let celebrationStylesheetPromise = null;
let eagleElement = null;
let eagleAudio = null;
let alertElement = null;
let alertDismissTimeout = null;
let confettiContainer = null;
let confettiCleanupTimeout = null;
let unitToggleButton = null;

const getStatus = () => storedContext.status ?? (() => {});
const getUpdate = () => storedContext.update ?? (() => {});

function getUnitToggleButton() {
  if (typeof document === 'undefined') return null;
  if (unitToggleButton && document.body.contains(unitToggleButton)) {
    return unitToggleButton;
  }
  unitToggleButton = document.querySelector('[data-role="units-toggle"]');
  return unitToggleButton;
}

function updateUnitToggleDisplay(units) {
  const button = getUnitToggleButton();
  if (!button) return;
  const system = getSystemForUnits(units);
  button.dataset.system = system;
  button.setAttribute('aria-pressed', system === 'imperial' ? 'true' : 'false');
  const label = button.querySelector('[data-role="units-toggle-label"]');
  const abbr = button.querySelector('[data-role="units-toggle-abbr"]');
  if (label) {
    label.textContent = system === 'imperial' ? 'Imperial Units' : 'Metric Units';
  }
  if (abbr) {
    abbr.textContent = units;
  }
  const targetSystem = system === 'imperial' ? 'metric' : 'imperial';
  const targetUnits = targetSystem === 'imperial' ? 'in' : 'mm';
  const hint = `Switch to ${targetSystem} units (${targetUnits})`;
  button.setAttribute('title', hint);
  button.setAttribute('aria-label', hint);
}

function initializeUnitToggle() {
  const button = getUnitToggleButton();
  if (!button || button.dataset.bound === 'true') return;
  button.dataset.bound = 'true';
  button.addEventListener('click', () => {
    const nextUnits = currentUnitsSelection === 'in' ? 'mm' : 'in';
    setUnits(nextUnits);
  });
  updateUnitToggleDisplay(currentUnitsSelection);
}

function ensureCelebrationStyles() {
  if (typeof document === 'undefined') return Promise.resolve();

  const existing = document.querySelector(`link[${CELEBRATION_STYLESHEET_ATTR}]`);
  if (existing && existing.sheet) {
    return Promise.resolve(existing);
  }

  if (celebrationStylesheetPromise) {
    return celebrationStylesheetPromise;
  }

  celebrationStylesheetPromise = new Promise((resolve, reject) => {
    const link = existing || document.createElement('link');

    function handleLoad() {
      link.removeEventListener('load', handleLoad);
      link.removeEventListener('error', handleError);
      resolve(link);
    }

    function handleError(event) {
      link.removeEventListener('load', handleLoad);
      link.removeEventListener('error', handleError);
      celebrationStylesheetPromise = null;
      reject(event);
    }

    if (!existing) {
      link.rel = 'stylesheet';
      link.href = CELEBRATION_STYLESHEET_URL;
      link.setAttribute(CELEBRATION_STYLESHEET_ATTR, 'true');
      document.head.appendChild(link);
    } else if (existing.sheet) {
      resolve(existing);
      return;
    }

    link.addEventListener('load', handleLoad, { once: true });
    link.addEventListener('error', handleError, { once: true });
  }).catch((error) => {
    console.warn('Failed to load celebration styles:', error);
    throw error;
  });

  return celebrationStylesheetPromise;
}

function destroyConfetti() {
  if (confettiCleanupTimeout) {
    clearTimeout(confettiCleanupTimeout);
    confettiCleanupTimeout = null;
  }
  if (confettiContainer) {
    confettiContainer.remove();
    confettiContainer = null;
  }
}

function launchConfetti() {
  if (typeof document === 'undefined') return;
  destroyConfetti();
  const container = document.createElement('div');
  container.className = CONFETTI_CLASS;
  const totalPieces = 60;
  let maxLifespan = 0;
  for (let i = 0; i < totalPieces; i += 1) {
    const piece = document.createElement('span');
    piece.className = CONFETTI_PIECE_CLASS;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const startX = `${Math.random() * 100}vw`;
    const endX = `${Math.random() * 100}vw`;
    const rotation = `${Math.random() * 960 - 480}deg`;
    const duration = 3 + Math.random() * 2.5;
    const delay = Math.random() * 0.9;
    const scale = (0.6 + Math.random() * 0.7).toFixed(2);
    piece.style.setProperty('--confetti-color', color);
    piece.style.setProperty('--confetti-x-start', startX);
    piece.style.setProperty('--confetti-x-end', endX);
    piece.style.setProperty('--confetti-rotation', rotation);
    piece.style.setProperty('--confetti-duration', `${duration}s`);
    piece.style.setProperty('--confetti-delay', `${delay}s`);
    piece.style.setProperty('--confetti-scale', scale);
    container.appendChild(piece);
    maxLifespan = Math.max(maxLifespan, duration + delay);
  }
  document.body.appendChild(container);
  confettiContainer = container;
  confettiCleanupTimeout = window.setTimeout(() => {
    destroyConfetti();
  }, (maxLifespan + 0.5) * 1000);
}

function destroyEagle() {
  if (eagleElement) {
    eagleElement.removeEventListener('animationend', destroyEagle);
    eagleElement.remove();
    eagleElement = null;
  }
  if (eagleAudio) {
    eagleAudio.pause();
    try {
      eagleAudio.currentTime = 0;
    } catch (err) {
      // Some browsers may not allow resetting currentTime immediately after pause.
    }
  }
  destroyConfetti();
}

function triggerFreedomEagle() {
  destroyEagle();
  if (!eagleAudio) {
    eagleAudio = new Audio(EAGLE_AUDIO_SRC);
    eagleAudio.preload = 'auto';
  }
  const playPromise = eagleAudio.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }

  ensureCelebrationStyles()
    .then(() => {
      const img = document.createElement('img');
      img.src = EAGLE_IMAGE_SRC;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.className = EAGLE_CLASS;
      img.addEventListener('animationend', destroyEagle, { once: true });
      document.body.appendChild(img);
      eagleElement = img;
      launchConfetti();
    })
    .catch(() => {
      // If the stylesheet fails to load, we silently skip the visual celebration.
    });
}

function dismissAlert() {
  if (alertDismissTimeout) {
    clearTimeout(alertDismissTimeout);
    alertDismissTimeout = null;
  }
  if (alertElement) {
    alertElement.remove();
    alertElement = null;
  }
}

function showFreedomAlert() {
  dismissAlert();
  destroyEagle();
  ensureCelebrationStyles()
    .then(() => {
      const alert = document.createElement('div');
      alert.className = ALERT_CLASS;
      alert.textContent = 'FREEDOM MODE OFF';
      document.body.appendChild(alert);
      alertElement = alert;
      alertDismissTimeout = setTimeout(dismissAlert, 3500);
    })
    .catch(() => {
      // No alert if the stylesheet cannot be loaded.
    });
}

function setAutoMarginMode(enabled) {
  autoMarginMode = Boolean(enabled);
  marginInputSelectors.forEach((selector) => {
    const el = $(selector);
    if (!el) return;
    if (autoMarginMode) {
      el.dataset.auto = 'true';
      el.value = '';
    } else {
      delete el.dataset.auto;
    }
  });
}

function syncDocCountStateFromValue(el) {
  if (!el) return;
  const trimmed = (el.value || '').trim();
  if (trimmed === '') {
    el.dataset.autoActive = 'true';
    el.dataset.autoValue = '';
  } else {
    el.dataset.autoActive = 'false';
    delete el.dataset.autoValue;
  }
}

function resetDocCountState() {
  docCountSelectors.forEach((selector) => {
    const el = $(selector);
    if (!el) return;
    el.value = '';
    syncDocCountStateFromValue(el);
  });
}

function getSystemForUnits(units) {
  return UNIT_TO_SYSTEM[units] || 'imperial';
}

function filterPresetsBySystem(presets, system) {
  return presets.filter((preset) => {
    if (!Array.isArray(preset.systems) || preset.systems.length === 0) return true;
    return preset.systems.includes(system);
  });
}

function populatePresetSelect(selectEl, presets, system, memoryKey) {
  if (!selectEl) return;
  const placeholder =
    selectEl.dataset.placeholder ||
    selectEl.querySelector('option[value=""]')?.textContent ||
    'Choose a preset…';
  const filtered = filterPresetsBySystem(presets, system);
  selectEl.innerHTML = '';
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = placeholder;
  selectEl.appendChild(placeholderOption);
  filtered.forEach((preset) => {
    const option = document.createElement('option');
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
    selectEl.value = '';
  }
}

function handlePresetSelect(selectEl, memoryKey, applyPreset) {
  if (!selectEl) return;
  selectEl.addEventListener('change', (event) => {
    const option = event.target.selectedOptions?.[0];
    const units = currentUnitsSelection;
    const system = getSystemForUnits(units);
    const memory = presetSelectionMemory[memoryKey];
    if (memory) {
      memory[system] = event.target.value || '';
    }
    if (!option || !option.value) return;
    const width = Number(option.dataset.width);
    const height = Number(option.dataset.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    applyPreset(width, height);
    getUpdate()();
  });
}

function setSheetPreset(w, h) {
  const units = currentUnitsSelection;
  const width = convertForUnits(w, units);
  const height = convertForUnits(h, units);
  $('#sheetW').value = width;
  $('#sheetH').value = height;
  getStatus()(`Sheet preset ${describePresetValue(w, units)}×${describePresetValue(h, units)} ${units}`);
}

function setDocumentPreset(w, h) {
  const units = currentUnitsSelection;
  const width = convertForUnits(w, units);
  const height = convertForUnits(h, units);
  $('#docW').value = width;
  $('#docH').value = height;
  getStatus()(`Document preset ${describePresetValue(w, units)}×${describePresetValue(h, units)} ${units}`);
}

function setGutterPreset(horizontal, vertical) {
  const units = currentUnitsSelection;
  const h = convertForUnits(horizontal, units);
  const v = convertForUnits(vertical, units);
  $('#gutH').value = h;
  $('#gutV').value = v;
  getStatus()(`Gutter preset ${describePresetValue(horizontal, units)}×${describePresetValue(vertical, units)} ${units}`);
}

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
    el.setAttribute(attr, formatUnitsValue(numeric * MM_PER_INCH, 'mm', 4));
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
  const precision = getUnitsPrecision(toUnits);
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
        el.value = formatUnitsValue(converted, toUnits, precision);
      });
    }
  }
  applyNumericInputUnits(toUnits);
}

function setUnits(nextUnits, options = {}) {
  if (!nextUnits) return;
  const { skipConversion = false, silent = false } = options;
  const previousUnits = currentUnitsSelection;
  if (!skipConversion && previousUnits !== nextUnits) {
    convertInputs(previousUnits, nextUnits);
  }
  currentUnitsSelection = nextUnits;
  updateUnitToggleDisplay(nextUnits);
  applyNumericInputUnits(nextUnits);
  refreshPresetDropdowns(getSystemForUnits(nextUnits));
  if (!silent) {
    getStatus()('Units changed');
    getUpdate()();
    handleUnitCelebration(nextUnits);
  } else {
    dismissAlert();
    destroyEagle();
  }
}

function handleUnitCelebration(units) {
  if (units === 'in') {
    dismissAlert();
    triggerFreedomEagle();
  } else {
    destroyEagle();
  }

  if (units === 'mm') {
    showFreedomAlert();
  } else if (units !== 'in') {
    dismissAlert();
  }
}

function applyDefaultInputs() {
  const { units, sheet, document, gutter, nonPrintable } = DEFAULT_INPUTS;
  const precision = getUnitsPrecision(units);
  const setValue = (selector, value) => {
    const el = $(selector);
    if (!el) return;
    if (value == null || value === '') {
      el.value = '';
      return;
    }
    el.value = formatUnitsValue(value, units, precision);
  };

  setUnits(units, { skipConversion: true, silent: true });
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

  ['#mTop', '#mRight', '#mBottom', '#mLeft', '#scoresV', '#scoresH', '#perfV', '#perfH'].forEach(
    (selector) => {
      const el = $(selector);
      if (!el) return;
      el.value = '';
    }
  );

  resetDocCountState();

  getStatus()('');
}

function refreshPresetDropdowns(system) {
  populatePresetSelect($('#sheetPresetSelect'), sheetPresets, system, 'sheet');
  populatePresetSelect($('#documentPresetSelect'), documentPresets, system, 'document');
  populatePresetSelect($('#gutterPresetSelect'), gutterPresets, system, 'gutter');
}

function attachMarginListeners() {
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
}

function attachDocCountListeners() {
  docCountSelectors.forEach((selector) => {
    const el = $(selector);
    if (!el) return;
    syncDocCountStateFromValue(el);
    el.addEventListener('input', () => {
      syncDocCountStateFromValue(el);
      getUpdate()();
    });
  });
}

function attachPresetDropdownHandlers() {
  handlePresetSelect($('#sheetPresetSelect'), 'sheet', setSheetPreset);
  handlePresetSelect($('#documentPresetSelect'), 'document', setDocumentPreset);
  handlePresetSelect($('#gutterPresetSelect'), 'gutter', setGutterPreset);
}

function attachActionButtons() {
  $('#calcBtn')?.addEventListener('click', () => getUpdate()());
  $('#resetBtn')?.addEventListener('click', () => {
    applyDefaultInputs();
    getUpdate()();
  });
}

function attachApplyButtons() {
  $('#applyScores')?.addEventListener('click', () => getUpdate()());
  $('#applyPerforations')?.addEventListener('click', () => getUpdate()());
}

function swapInputValues(selectorA, selectorB) {
  const elA = $(selectorA);
  const elB = $(selectorB);
  if (!elA || !elB) return false;
  const temp = elA.value;
  elA.value = elB.value;
  elB.value = temp;
  return true;
}

function attachSwapButtons() {
  const buttons = document.querySelectorAll('.input-swap-button[data-swap-targets]');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const rawTargets = button.dataset.swapTargets || '';
      const selectors = rawTargets
        .split(',')
        .map((selector) => selector.trim())
        .filter(Boolean);
      if (selectors.length !== 2) return;
      if (!swapInputValues(selectors[0], selectors[1])) return;
      const message = button.dataset.swapMessage;
      if (message) {
        getStatus()(message);
      }
      getUpdate()();
    });
  });
}

function attachKeyboardShortcut() {
  if (keydownHandlerAttached) return;
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') getUpdate()();
  });
  keydownHandlerAttached = true;
}

function runUnitConversionRegression() {
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
}

function init(context = {}) {
  hydrateTabPanel(TAB_KEY);
  storedContext = { ...storedContext, ...context };
  initializeUnitToggle();
  if (initialized) return;
  setAutoMarginMode(autoMarginMode);
  attachMarginListeners();
  attachDocCountListeners();
  attachPresetDropdownHandlers();
  attachActionButtons();
  attachSwapButtons();
  attachApplyButtons();
  attachKeyboardShortcut();
  applyDefaultInputs();
  runUnitConversionRegression();
  initialized = true;
}

const inputsTab = {
  key: 'inputs',
  init,
  onActivate() {
    init(storedContext);
  },
  onRegister({ update, status }) {
    storedContext = { update, status };
    init(storedContext);
  },
};

export function isAutoMarginModeEnabled() {
  return autoMarginMode;
}

export function enableAutoMarginMode(enabled) {
  setAutoMarginMode(enabled);
}

export function getCurrentUnits() {
  return currentUnitsSelection;
}

export default inputsTab;
