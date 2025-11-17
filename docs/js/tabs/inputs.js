import { sheetPresets, documentPresets, gutterPresets } from '../data/input-presets.js';
import { DEFAULT_INPUTS, getDefaultInputsForUnits } from '../config/defaults.js';
import { $ } from '../utils/dom.js';
import {
  MM_PER_INCH,
  describePresetValue,
  formatUnitsValue,
  getUnitsPrecision,
} from '../utils/units.js';
import { hydrateTabPanel } from './registry.js';
import { detectPreferredUnits } from '../utils/measurement-system.js';

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

const CANONICAL_INCHES_ATTR = 'inches';

/**
 * Normalizes arbitrary unit identifiers down to the two measurement systems the
 * calculator supports. Any unexpected value is treated as inches so the math
 * layer always has a deterministic fallback.
 */
const normalizeUnits = (units) => (units === 'mm' ? 'mm' : 'in');

const INITIAL_UNITS = detectPreferredUnits(DEFAULT_INPUTS.units);

/**
 * Persists the canonical inch measurement for a numeric input so the layout
 * engine never has to reconstruct inches from whatever string happens to be in
 * the text box. The value is removed entirely when it is not finite so callers
 * can clear out stale measurements by passing `NaN`/`undefined`/`null`.
 */
function storeCanonicalInches(el, inches) {
  if (!el) return;
  if (Number.isFinite(inches)) {
    el.dataset[CANONICAL_INCHES_ATTR] = String(inches);
  } else {
    delete el.dataset[CANONICAL_INCHES_ATTR];
  }
}

/**
 * Converts a user-facing numeric value into inches based on the units that are
 * currently displayed next to the input. A blank or non-numeric entry returns
 * `null` so the caller can decide whether to fall back or clear the field.
 */
function coerceToInches(value, units) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return normalizeUnits(units) === 'mm' ? numeric / MM_PER_INCH : numeric;
}

/**
 * Reads the most precise inch measurement available for an input. It prefers
 * the cached canonical value but will gracefully fall back to converting the
 * current string if the cache is missing (for example on the very first render
 * before initialization wires up the dataset attribute).
 */
function readCanonicalInches(el, fallbackUnits = currentUnitsSelection) {
  if (!el) return null;
  const stored = Number(el.dataset?.[CANONICAL_INCHES_ATTR]);
  if (Number.isFinite(stored)) return stored;
  return coerceToInches(el.value, fallbackUnits);
}

/**
 * Writes a formatted value to an input *and* updates its cached inch
 * measurement. Downstream code always works with this canonical value so unit
 * toggles merely re-render the text instead of compounding rounding errors.
 */
function writeMeasurementElement(el, inches, units = currentUnitsSelection) {
  if (!el) return;
  if (!Number.isFinite(inches)) {
    el.value = '';
    storeCanonicalInches(el, Number.NaN);
    return;
  }
  const targetUnits = normalizeUnits(units);
  storeCanonicalInches(el, inches);
  const converted = targetUnits === 'mm' ? inches * MM_PER_INCH : inches;
  const precision = getUnitsPrecision(targetUnits);
  el.value = formatUnitsValue(converted, targetUnits, precision);
}

/**
 * Synchronizes the canonical inch cache with the current text in the input.
 * This is used by user-driven events so manual edits are reflected without
 * waiting for the next calculation pass.
 */
function syncCanonicalFromDisplay(el, units = currentUnitsSelection) {
  if (!el) return;
  const inches = coerceToInches(el.value, units);
  storeCanonicalInches(el, inches);
}

/**
 * Renders every numeric input in the requested units using the stored inch
 * value as the source of truth. If an input has never recorded a canonical
 * value we attempt to translate the existing display string so the caller does
 * not lose partially-entered data during initialization.
 */
function refreshNumericInputDisplays(targetUnits, fallbackUnits = targetUnits) {
  const desiredUnits = normalizeUnits(targetUnits);
  const assumedUnits = normalizeUnits(fallbackUnits);
  numericInputSelectors.forEach((selector) => {
    const el = $(selector);
    if (!el) return;
    const inches = readCanonicalInches(el, assumedUnits);
    if (!Number.isFinite(inches)) {
      writeMeasurementElement(el, Number.NaN, desiredUnits);
      return;
    }
    writeMeasurementElement(el, inches, desiredUnits);
  });
}

/**
 * Convenience wrapper used by the rest of the module (and a few external
 * callers) to update both the visible value and canonical inch cache for a
 * specific input.
 */
function setMeasurementInput(selector, inches, units = currentUnitsSelection) {
  const el = $(selector);
  if (!el) return;
  writeMeasurementElement(el, inches, units);
}

function applyDefaultsToInputs(defaults) {
  if (!defaults) return;
  const { sheet, document, gutter, nonPrintable } = defaults;
  setMeasurementInput('#sheetW', sheet?.width);
  setMeasurementInput('#sheetH', sheet?.height);
  setMeasurementInput('#docW', document?.width);
  setMeasurementInput('#docH', document?.height);
  setMeasurementInput('#gutH', gutter?.horizontal);
  setMeasurementInput('#gutV', gutter?.vertical);
  setMeasurementInput('#npTop', nonPrintable?.top);
  setMeasurementInput('#npRight', nonPrintable?.right);
  setMeasurementInput('#npBottom', nonPrintable?.bottom);
  setMeasurementInput('#npLeft', nonPrintable?.left);
}

function clearOptionalInputs() {
  ['#scoresV', '#scoresH', '#perfV', '#perfH'].forEach((selector) => {
    const el = $(selector);
    if (!el) return;
    el.value = '';
  });
}

function rememberSystemPresetDefaults(system) {
  const defaults = SYSTEM_DEFAULT_PRESET_IDS[system];
  if (!defaults) return;
  if (presetSelectionMemory.sheet) {
    presetSelectionMemory.sheet[system] = defaults.sheet;
  }
  if (presetSelectionMemory.document) {
    presetSelectionMemory.document[system] = defaults.document;
  }
  if (presetSelectionMemory.gutter) {
    presetSelectionMemory.gutter[system] = defaults.gutter;
  }
}

function applySystemDefaultInputs(system) {
  const units = system === 'metric' ? 'mm' : 'in';
  const defaults = getDefaultInputsForUnits(units);
  setAutoMarginMode(true);
  applyDefaultsToInputs(defaults);
  clearOptionalInputs();
  resetDocCountState();
  rememberSystemPresetDefaults(system);
}

const UNIT_TO_SYSTEM = { in: 'imperial', mm: 'metric' };
const presetSelectionMemory = {
  sheet: { imperial: '', metric: '' },
  document: { imperial: '', metric: '' },
  gutter: { imperial: '', metric: '' },
};

const SYSTEM_DEFAULT_PRESET_IDS = {
  imperial: {
    sheet: 'sheet-1218',
    document: 'doc-35x2',
    gutter: 'gut-eighth',
  },
  metric: {
    sheet: 'sheet-a3',
    document: 'doc-85x55',
    gutter: 'gut-3mm',
  },
};

let initialized = false;
let autoMarginMode = true;
let currentUnitsSelection = INITIAL_UNITS;
let storedContext = { update: () => {}, status: () => {} };
let keydownHandlerAttached = false;

const EAGLE_IMAGE_SRC = 'media/eagle.svg';
const EAGLE_AUDIO_SRC = 'media/eagle.wav';
const EAGLE_CLASS = 'freedom-eagle';
const ALERT_CLASS = 'freedom-alert';
const ALERT_HEADLINE_CLASS = 'freedom-alert__headline';
const ALERT_DETAIL_CLASS = 'freedom-alert__detail';
const METRIC_ALERT_DURATION_MS = 5000;
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
      alert.setAttribute('role', 'status');
      alert.setAttribute('aria-live', 'assertive');

      const headline = document.createElement('span');
      headline.className = ALERT_HEADLINE_CLASS;
      headline.textContent = 'Freedom mode off';

      const detail = document.createElement('span');
      detail.className = ALERT_DETAIL_CLASS;
      detail.textContent = 'Metric defaults loaded';

      alert.append(headline, detail);
      document.body.appendChild(alert);
      alertElement = alert;
      alertDismissTimeout = setTimeout(dismissAlert, METRIC_ALERT_DURATION_MS);
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
      // Auto mode starts from a blank slate so downstream calculations can
      // repopulate the margin inputs with derived values. Clearing via the
      // shared helper also removes any stale canonical inches cache.
      writeMeasurementElement(el, Number.NaN, currentUnitsSelection);
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
  setMeasurementInput('#sheetW', Number(w), units);
  setMeasurementInput('#sheetH', Number(h), units);
  getStatus()(`Sheet preset ${describePresetValue(w, units)}×${describePresetValue(h, units)} ${units}`);
}

function setDocumentPreset(w, h) {
  const units = currentUnitsSelection;
  setMeasurementInput('#docW', Number(w), units);
  setMeasurementInput('#docH', Number(h), units);
  getStatus()(`Document preset ${describePresetValue(w, units)}×${describePresetValue(h, units)} ${units}`);
}

function setGutterPreset(horizontal, vertical) {
  const units = currentUnitsSelection;
  setMeasurementInput('#gutH', Number(horizontal), units);
  setMeasurementInput('#gutV', Number(vertical), units);
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
  // Always render from the canonical inch cache so we do not accumulate
  // rounding error when users flip back and forth between metric/imperial.
  const safeTo = normalizeUnits(toUnits);
  const safeFrom = fromUnits ? normalizeUnits(fromUnits) : safeTo;
  refreshNumericInputDisplays(safeTo, safeFrom);
  applyNumericInputUnits(safeTo);
}

function broadcastUnitsChange(units) {
  if (typeof document === 'undefined') return;
  try {
    document.dispatchEvent(
      new CustomEvent('calculator:units-change', {
        detail: { units },
      }),
    );
  } catch (error) {
    console.warn('Failed to broadcast units change', error);
  }
}

function setUnits(nextUnits, options = {}) {
  if (!nextUnits) return;
  const { skipConversion = false, silent = false } = options;
  const previousUnits = currentUnitsSelection;
  const nextSystem = getSystemForUnits(nextUnits);
  const previousSystem = getSystemForUnits(previousUnits);
  currentUnitsSelection = nextUnits;
  if (!skipConversion && previousUnits !== nextUnits) {
    if (previousSystem !== nextSystem) {
      applySystemDefaultInputs(nextSystem);
    } else {
      convertInputs(previousUnits, nextUnits);
    }
  }
  updateUnitToggleDisplay(nextUnits);
  applyNumericInputUnits(nextUnits);
  refreshPresetDropdowns(nextSystem);
  broadcastUnitsChange(nextUnits);
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
  const units = INITIAL_UNITS;
  setUnits(units, { skipConversion: true, silent: true });
  applySystemDefaultInputs(getSystemForUnits(units));
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

function attachCanonicalMeasurementListeners() {
  numericInputSelectors.forEach((selector) => {
    const el = $(selector);
    if (!el || el.dataset.canonicalBound === 'true') return;
    const sync = () => syncCanonicalFromDisplay(el);
    ['input', 'change', 'blur'].forEach((evt) => el.addEventListener(evt, sync));
    el.dataset.canonicalBound = 'true';
    // Capture any server-rendered defaults before we start manipulating the
    // value programmatically so the canonical cache is always populated.
    sync();
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
  const units = currentUnitsSelection;
  const inchesA = readCanonicalInches(elA, units);
  const inchesB = readCanonicalInches(elB, units);
  writeMeasurementElement(elA, Number.isFinite(inchesB) ? inchesB : Number.NaN, units);
  writeMeasurementElement(elB, Number.isFinite(inchesA) ? inchesA : Number.NaN, units);
  return true;
}

function attachSwapButtons() {
  // Swap buttons are used in multiple layouts with slightly different class
  // names, so we listen for both the legacy `.input-swap-button` and the newer
  // `.btn-swap` selector while we migrate the markup. Each button declares the
  // selectors for the paired inputs (and an optional status message) via
  // `data-swap-*` attributes.
  const buttons = document.querySelectorAll(
    '.btn-swap[data-swap-targets], .input-swap-button[data-swap-targets]'
  );
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const rawTargets = button.dataset.swapTargets || '';
      const selectors = rawTargets
        .split(',')
        .map((selector) => selector.trim())
        .filter(Boolean);
      if (selectors.length !== 2) return;
      if (!swapInputValues(selectors[0], selectors[1])) return;
      // If provided, broadcast the contextual status string (e.g. "Swapped"
      // for the document dimensions) so the user sees immediate feedback.
      const message = button.dataset.swapMessage;
      if (message) {
        getStatus()(message);
      }
      // Swapping inputs affects the downstream layout math, so trigger the same
      // recalculation/visual refresh as the primary "calculate" button.
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

function init(context = {}) {
  hydrateTabPanel(TAB_KEY);
  storedContext = { ...storedContext, ...context };
  initializeUnitToggle();
  if (initialized) return;
  setAutoMarginMode(autoMarginMode);
  attachMarginListeners();
  attachDocCountListeners();
  attachCanonicalMeasurementListeners();
  attachPresetDropdownHandlers();
  attachActionButtons();
  attachSwapButtons();
  attachApplyButtons();
  attachKeyboardShortcut();
  applyDefaultInputs();
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

export { setMeasurementInput, convertInputs };

export default inputsTab;
