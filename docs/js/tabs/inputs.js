import { sheetPresets, documentPresets, gutterPresets } from '../data/input-presets.js';
import { DEFAULT_INPUTS } from '../config/defaults.js';
import { $, $$ } from '../utils/dom.js';
import {
  MM_PER_INCH,
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

const marginAutoToggleSelector = '#marginAutoToggle';
const horizontalAlignmentSelector = '[data-align-horizontal]';
const verticalAlignmentSelector = '[data-align-vertical]';

const AUTO_SUMMARY_TEXT =
  'Auto alignment balances the printable layout inside the sheet. Switch to manual offsets to anchor the layout to specific edges.';
const AUTO_INPUT_HINT_TEXT = 'Auto mode fills these offsets for you after each update.';
const MANUAL_INPUT_HINT_TEXT = 'Update the highlighted offsets below to pin the layout where you need it.';

const ALIGNMENT_HINTS = {
  horizontal: {
    left: 'Pin to the left printable edge. Set the left offset; the right value becomes trailing space.',
    center: 'Keep the layout centered left-to-right. Adjust both offsets if you need extra clearance.',
    right: 'Pin to the right printable edge. Set the right offset; the left value becomes trailing space.',
  },
  vertical: {
    top: 'Pin to the top printable edge. Set the top offset; the bottom value becomes trailing space.',
    center: 'Keep the layout centered top-to-bottom. Adjust both offsets if you need extra clearance.',
    bottom: 'Pin to the bottom printable edge. Set the bottom offset; the top value becomes trailing space.',
  },
};

const ALIGNMENT_STATUS_MESSAGES = {
  horizontal: {
    left: 'Horizontal anchor set to the left edge.',
    center: 'Horizontal anchor centered.',
    right: 'Horizontal anchor set to the right edge.',
  },
  vertical: {
    top: 'Vertical anchor set to the top edge.',
    center: 'Vertical anchor centered.',
    bottom: 'Vertical anchor set to the bottom edge.',
  },
};

const MARGIN_ALIGNMENT_DEFAULT = { horizontal: 'center', vertical: 'center' };

const CANONICAL_INCHES_ATTR = 'inches';

/**
 * Normalizes arbitrary unit identifiers down to the two measurement systems the
 * calculator supports. Any unexpected value is treated as inches so the math
 * layer always has a deterministic fallback.
 */
const normalizeUnits = (units) => (units === 'mm' ? 'mm' : 'in');

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

const UNIT_TO_SYSTEM = { in: 'imperial', mm: 'metric' };
const presetSelectionMemory = {
  sheet: { imperial: '', metric: '' },
  document: { imperial: '', metric: '' },
  gutter: { imperial: '', metric: '' },
};

let initialized = false;
let autoMarginMode = true;
let marginAlignment = { ...MARGIN_ALIGNMENT_DEFAULT };
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

function getMarginEdgeLabelForInput(el) {
  if (!el || typeof el.closest !== 'function') return null;
  return el.closest('[data-margin-edge]');
}

function describeAnchor(axis, value) {
  if (value === 'center') {
    return axis === 'horizontal' ? 'centered horizontally' : 'centered vertically';
  }
  return `locked to the ${value} edge`;
}

function updateMarginAutoToggle() {
  const toggle = $(marginAutoToggleSelector);
  if (!toggle) return;
  toggle.dataset.active = autoMarginMode ? 'true' : 'false';
  toggle.setAttribute('aria-pressed', autoMarginMode ? 'true' : 'false');
  toggle.textContent = autoMarginMode ? 'Auto alignment: On' : 'Auto alignment: Off';
  const hint = autoMarginMode ? 'Switch to manual offsets' : 'Return to automatic centering';
  toggle.setAttribute('title', hint);
  toggle.setAttribute('aria-label', hint);
}

function updateMarginAlignmentCopy() {
  const summary = $('#marginAlignSummary');
  if (summary) {
    if (autoMarginMode) {
      summary.textContent = AUTO_SUMMARY_TEXT;
    } else {
      const { horizontal, vertical } = marginAlignment;
      summary.textContent = `Manual alignment pins the layout ${describeAnchor('horizontal', horizontal)} and ${describeAnchor(
        'vertical',
        vertical
      )}. Adjust the highlighted offsets to set your clearance.`;
    }
  }

  const horizontalHint = $('#marginHorizontalHint');
  if (horizontalHint) {
    const key = autoMarginMode ? 'center' : marginAlignment.horizontal;
    horizontalHint.textContent = ALIGNMENT_HINTS.horizontal[key] || '';
  }

  const verticalHint = $('#marginVerticalHint');
  if (verticalHint) {
    const key = autoMarginMode ? 'center' : marginAlignment.vertical;
    verticalHint.textContent = ALIGNMENT_HINTS.vertical[key] || '';
  }

  const inputHint = $('#marginInputHint');
  if (inputHint) {
    inputHint.textContent = autoMarginMode ? AUTO_INPUT_HINT_TEXT : MANUAL_INPUT_HINT_TEXT;
  }
}

function updateMarginAlignmentUI() {
  const { horizontal, vertical } = marginAlignment;

  $$(horizontalAlignmentSelector).forEach((btn) => {
    const value = btn.dataset.alignHorizontal;
    const active = value === horizontal;
    btn.dataset.active = active ? 'true' : 'false';
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.disabled = autoMarginMode;
  });

  $$(verticalAlignmentSelector).forEach((btn) => {
    const value = btn.dataset.alignVertical;
    const active = value === vertical;
    btn.dataset.active = active ? 'true' : 'false';
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.disabled = autoMarginMode;
  });

  const horizontalEdges = autoMarginMode || horizontal === 'center' ? ['left', 'right'] : [horizontal];
  const verticalEdges = autoMarginMode || vertical === 'center' ? ['top', 'bottom'] : [vertical];

  marginInputSelectors.forEach((selector) => {
    const input = $(selector);
    if (!input) return;
    const label = getMarginEdgeLabelForInput(input);
    if (!label) return;
    const edge = label.dataset.marginEdge;
    const axis = label.dataset.marginAxis;
    const isHorizontalEdge = axis === 'horizontal';
    const isActive = isHorizontalEdge
      ? horizontalEdges.includes(edge)
      : verticalEdges.includes(edge);
    if (isActive) {
      label.dataset.anchorActive = 'true';
    } else {
      delete label.dataset.anchorActive;
    }
    if (autoMarginMode) {
      label.dataset.auto = 'true';
    } else {
      delete label.dataset.auto;
    }
  });

  updateMarginAlignmentCopy();
}

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
  if (autoMarginMode) {
    marginAlignment = { ...MARGIN_ALIGNMENT_DEFAULT };
  }
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
  updateMarginAutoToggle();
  updateMarginAlignmentUI();
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
  setUnits(units, { skipConversion: true, silent: true });
  setAutoMarginMode(true);

  setMeasurementInput('#sheetW', sheet.width, units);
  setMeasurementInput('#sheetH', sheet.height, units);
  setMeasurementInput('#docW', document.width, units);
  setMeasurementInput('#docH', document.height, units);
  setMeasurementInput('#gutH', gutter.horizontal, units);
  setMeasurementInput('#gutV', gutter.vertical, units);
  setMeasurementInput('#npTop', nonPrintable.top, units);
  setMeasurementInput('#npRight', nonPrintable.right, units);
  setMeasurementInput('#npBottom', nonPrintable.bottom, units);
  setMeasurementInput('#npLeft', nonPrintable.left, units);

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

function handleAlignmentSelection(axis, value) {
  if (!value) return;
  if (autoMarginMode) {
    setAutoMarginMode(false);
    getStatus()('Manual alignment enabled — adjust the highlighted offsets.');
  }
  if (marginAlignment[axis] === value && !autoMarginMode) {
    updateMarginAlignmentUI();
    return;
  }
  marginAlignment = { ...marginAlignment, [axis]: value };
  const message = ALIGNMENT_STATUS_MESSAGES[axis]?.[value];
  if (message) {
    getStatus()(message);
  }
  updateMarginAlignmentUI();
}

function attachMarginAlignmentControls() {
  $$(horizontalAlignmentSelector).forEach((btn) => {
    if (!btn || btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
      const value = btn.dataset.alignHorizontal;
      handleAlignmentSelection('horizontal', value);
    });
  });

  $$(verticalAlignmentSelector).forEach((btn) => {
    if (!btn || btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
      const value = btn.dataset.alignVertical;
      handleAlignmentSelection('vertical', value);
    });
  });

  const autoToggle = $(marginAutoToggleSelector);
  if (autoToggle && autoToggle.dataset.bound !== 'true') {
    autoToggle.dataset.bound = 'true';
    autoToggle.addEventListener('click', () => {
      const next = !autoMarginMode;
      setAutoMarginMode(next);
      if (next) {
        getStatus()('Auto alignment enabled.');
      } else {
        getStatus()('Manual alignment enabled — adjust the highlighted offsets.');
      }
      getUpdate()();
    });
  }

  updateMarginAutoToggle();
  updateMarginAlignmentUI();
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
  attachMarginAlignmentControls();
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

export { setMeasurementInput };

export default inputsTab;
