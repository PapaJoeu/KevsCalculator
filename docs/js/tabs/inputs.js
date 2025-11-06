import { sheetPresets, documentPresets, gutterPresets } from '../input-presets.js';
import { DEFAULT_INPUTS } from '../config/defaults.js';
import { $ } from '../utils/dom.js';
import { MM_PER_INCH, convertForUnits, describePresetValue } from '../utils/units.js';
import { hydrateTabPanel } from './registry.js';

const TAB_KEY = 'inputs';
const marginInputSelectors = ['#mTop', '#mRight', '#mBottom', '#mLeft'];
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
const UNIT_PRECISION = { in: 3, mm: 2 };
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

const getStatus = () => storedContext.status ?? (() => {});
const getUpdate = () => storedContext.update ?? (() => {});

const trimTrailingZeros = (str) => {
  if (!str.includes('.')) return str;
  const stripped = str.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
  return stripped === '' ? '0' : stripped;
};

const formatUnitValue = (value, precision) => trimTrailingZeros(Number(value || 0).toFixed(precision));

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
    const units = $('#units').value;
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
  const units = $('#units').value;
  const width = convertForUnits(w, units);
  const height = convertForUnits(h, units);
  $('#sheetW').value = width;
  $('#sheetH').value = height;
  getStatus()(`Sheet preset ${describePresetValue(w, units)}×${describePresetValue(h, units)} ${units}`);
}

function setDocumentPreset(w, h) {
  const units = $('#units').value;
  const width = convertForUnits(w, units);
  const height = convertForUnits(h, units);
  $('#docW').value = width;
  $('#docH').value = height;
  getStatus()(`Document preset ${describePresetValue(w, units)}×${describePresetValue(h, units)} ${units}`);
}

function setGutterPreset(horizontal, vertical) {
  const units = $('#units').value;
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

  getStatus()('');
  applyNumericInputUnits(units);
}

function refreshPresetDropdowns(system) {
  populatePresetSelect($('#sheetPresetSelect'), sheetPresets, system, 'sheet');
  populatePresetSelect($('#documentPresetSelect'), documentPresets, system, 'document');
  populatePresetSelect($('#gutterPresetSelect'), gutterPresets, system, 'gutter');
}

function attachUnitChangeListener(unitsSelect) {
  if (!unitsSelect) return;
  unitsSelect.addEventListener('change', (e) => {
    const nextUnits = e.target.value;
    convertInputs(currentUnitsSelection, nextUnits);
    currentUnitsSelection = nextUnits;
    refreshPresetDropdowns(getSystemForUnits(nextUnits));
    getStatus()('Units changed');
    getUpdate()();
  });
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

function attachPresetDropdownHandlers() {
  handlePresetSelect($('#sheetPresetSelect'), 'sheet', setSheetPreset);
  handlePresetSelect($('#documentPresetSelect'), 'document', setDocumentPreset);
  handlePresetSelect($('#gutterPresetSelect'), 'gutter', setGutterPreset);
}

function attachActionButtons() {
  $('#calcBtn')?.addEventListener('click', () => getUpdate()());
  $('#resetBtn')?.addEventListener('click', () => {
    applyDefaultInputs();
    refreshPresetDropdowns(getSystemForUnits(currentUnitsSelection));
    getUpdate()();
  });
}

function attachApplyButtons() {
  $('#applyScores')?.addEventListener('click', () => getUpdate()());
  $('#applyPerforations')?.addEventListener('click', () => getUpdate()());
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
  if (initialized) return;
  setAutoMarginMode(autoMarginMode);
  attachMarginListeners();
  attachUnitChangeListener($('#units'));
  attachPresetDropdownHandlers();
  attachActionButtons();
  attachApplyButtons();
  attachKeyboardShortcut();
  applyDefaultInputs();
  refreshPresetDropdowns(getSystemForUnits(currentUnitsSelection));
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

export function getCurrentUnitsSelection() {
  return currentUnitsSelection;
}

export function setCurrentUnitsSelection(units) {
  currentUnitsSelection = units;
}

export function getNumericInputSelectors() {
  return [...numericInputSelectors];
}

export default inputsTab;
