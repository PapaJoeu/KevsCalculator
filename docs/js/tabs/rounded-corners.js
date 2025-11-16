import { hydrateTabPanel } from './registry.js';
import { getCurrentUnits } from './inputs.js';
import { MM_PER_INCH, formatInchesForUnits, inchesToMillimeters } from '../utils/units.js';

const TAB_KEY = 'rounded-corners';
const CORNER_KEYS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
const CORNER_LABELS = {
  topLeft: 'Top left',
  topRight: 'Top right',
  bottomRight: 'Bottom right',
  bottomLeft: 'Bottom left',
};

let initialized = false;
let storedContext = { update: () => {}, status: () => {} };
let panelEl = null;
let unitListenerBound = false;

const elements = {
  globalInput: null,
  cornerInputs: new Map(),
  unitLabels: [],
  presetButtons: [],
  hiddenInput: null,
  summaryBody: null,
};

let cornerValues = defaultCornerValues();
let lastGlobalInches = 0;

function defaultCornerValues() {
  return { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };
}

const getUpdate = () => storedContext.update ?? (() => {});
const getStatus = () => storedContext.status ?? (() => {});

function ensurePanel() {
  if (panelEl) return panelEl;
  panelEl = hydrateTabPanel(TAB_KEY);
  return panelEl;
}

function sanitizeInches(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric;
}

function parseUnitsValue(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return getCurrentUnits() === 'mm' ? numeric / MM_PER_INCH : numeric;
}

function readHiddenValues() {
  const el = elements.hiddenInput;
  if (!el || !el.value) return defaultCornerValues();
  try {
    const parsed = JSON.parse(el.value);
    if (!parsed || typeof parsed !== 'object') {
      return defaultCornerValues();
    }
    return {
      topLeft: sanitizeInches(parsed.topLeft),
      topRight: sanitizeInches(parsed.topRight),
      bottomRight: sanitizeInches(parsed.bottomRight),
      bottomLeft: sanitizeInches(parsed.bottomLeft),
    };
  } catch (error) {
    console.warn('Unable to parse rounded corner cache', error);
    return defaultCornerValues();
  }
}

function syncHiddenValues() {
  if (!elements.hiddenInput) return;
  try {
    elements.hiddenInput.value = JSON.stringify(cornerValues);
  } catch (error) {
    console.warn('Failed to serialize rounded corners', error);
  }
}

function updateUnitLabels(units) {
  elements.unitLabels.forEach((label) => {
    label.textContent = units;
  });
}

function setInputAttributes(input, units) {
  if (!input) return;
  input.setAttribute('step', units === 'mm' ? '0.5' : '0.01');
}

function renderGlobalInput(units) {
  if (!elements.globalInput) return;
  elements.globalInput.value = formatInchesForUnits(lastGlobalInches, units);
  setInputAttributes(elements.globalInput, units);
}

function renderCornerInputs(units) {
  elements.cornerInputs.forEach((input, corner) => {
    const inches = cornerValues[corner] ?? 0;
    input.value = formatInchesForUnits(inches, units);
    setInputAttributes(input, units);
  });
}

function renderSummary() {
  if (!elements.summaryBody) return;
  const rows = CORNER_KEYS.map((corner) => {
    const inches = cornerValues[corner] ?? 0;
    const rounded = inches > 0;
    const label = CORNER_LABELS[corner];
    const inchesText = inches.toFixed(3);
    const mmText = inchesToMillimeters(inches, 2).toFixed(2);
    const status = rounded ? 'Rounded' : 'Square';
    return `<tr><td>${label}</td><td class="k">${inchesText}</td><td class="k">${mmText}</td><td>${status}</td></tr>`;
  }).join('');
  elements.summaryBody.innerHTML = rows;
}

function notifyChange(message) {
  syncHiddenValues();
  renderSummary();
  getUpdate()();
  if (message) {
    getStatus()(message);
  }
}

function applyGlobalRadius(inches, { message } = {}) {
  lastGlobalInches = sanitizeInches(inches);
  CORNER_KEYS.forEach((corner) => {
    cornerValues[corner] = lastGlobalInches;
  });
  const units = getCurrentUnits();
  renderGlobalInput(units);
  renderCornerInputs(units);
  notifyChange(message ?? 'Rounded corners updated');
}

function handleCornerInputChange(corner, value) {
  const inches = parseUnitsValue(value);
  if (inches == null) return;
  cornerValues[corner] = sanitizeInches(inches);
  notifyChange();
}

function handleGlobalInputChange(value) {
  const inches = parseUnitsValue(value);
  if (inches == null) return;
  applyGlobalRadius(inches, { message: 'Applied rounded corner radius to all corners' });
}

function handlePresetClick(button) {
  if (!button) return;
  const inchesAttr = button.dataset.radiusInches;
  const mmAttr = button.dataset.radiusMillimeters;
  let inches = null;
  if (inchesAttr != null) {
    inches = Number(inchesAttr);
  } else if (mmAttr != null) {
    const millimeters = Number(mmAttr);
    if (Number.isFinite(millimeters)) {
      inches = millimeters / MM_PER_INCH;
    }
  }
  if (inches == null || !Number.isFinite(inches) || inches < 0) return;
  applyGlobalRadius(inches, { message: 'Rounded corner preset applied' });
}

function handleUnitsChange(event) {
  const units = event?.detail?.units ?? getCurrentUnits();
  updateUnitLabels(units);
  renderGlobalInput(units);
  renderCornerInputs(units);
}

function bindEvents() {
  if (elements.globalInput) {
    elements.globalInput.addEventListener('input', (evt) => handleGlobalInputChange(evt.target.value));
  }
  elements.cornerInputs.forEach((input, corner) => {
    input.addEventListener('input', (evt) => handleCornerInputChange(corner, evt.target.value));
  });
  elements.presetButtons.forEach((button) => {
    button.addEventListener('click', () => handlePresetClick(button));
  });
  if (!unitListenerBound && typeof document !== 'undefined') {
    document.addEventListener('calculator:units-change', handleUnitsChange);
    unitListenerBound = true;
  }
}

function cacheElements() {
  const panel = ensurePanel();
  if (!panel) return;
  elements.globalInput = panel.querySelector('#roundedCornerGlobal');
  elements.unitLabels = Array.from(panel.querySelectorAll('[data-role="rounded-corner-units"]'));
  elements.summaryBody = panel.querySelector('#roundedCornersSummary tbody');
  elements.hiddenInput = panel.querySelector('#roundedCornersData');
  elements.cornerInputs.clear();
  CORNER_KEYS.forEach((corner) => {
    const input = panel.querySelector(`[data-corner-input="${corner}"]`);
    if (input) {
      elements.cornerInputs.set(corner, input);
    }
  });
  elements.presetButtons = Array.from(panel.querySelectorAll('[data-role="rounded-corner-presets"] button'));
}

function renderInitialState() {
  cornerValues = readHiddenValues();
  lastGlobalInches = cornerValues.topLeft ?? 0;
  const units = getCurrentUnits();
  updateUnitLabels(units);
  renderGlobalInput(units);
  renderCornerInputs(units);
  renderSummary();
}

function init(context = {}) {
  storedContext = { ...storedContext, ...context };
  ensurePanel();
  if (initialized || !panelEl) return;
  cacheElements();
  renderInitialState();
  bindEvents();
  syncHiddenValues();
  initialized = true;
}

const roundedCornersTab = {
  key: TAB_KEY,
  init,
  onActivate() {
    init(storedContext);
  },
  onRegister(context) {
    init(context);
  },
};

export default roundedCornersTab;
