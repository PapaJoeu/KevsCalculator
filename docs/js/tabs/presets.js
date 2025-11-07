import { layoutPresets } from '../data/layout-presets.js';
import { $, $$ } from '../utils/dom.js';
import { formatValueForUnits } from '../utils/units.js';
import { hydrateTabPanel } from './registry.js';
import { getCurrentUnits } from './inputs.js';

const TAB_KEY = 'presets';
const marginInputSelectors = ['#mTop', '#mRight', '#mBottom', '#mLeft'];

let initialized = false;
let presetMap = layoutPresets;
let storedContext = {
  update: () => {},
  status: () => {},
  enableAutoMarginMode: () => {},
  scoresApi: null,
  perforationsApi: null,
};

const getStatus = () => storedContext.status ?? (() => {});
const getUpdate = () => storedContext.update ?? (() => {});

function clearMarginInputs() {
  marginInputSelectors.forEach((selector) => {
    const el = $(selector);
    if (el) el.value = '';
  });
}

function setValueForUnits(selector, value, units) {
  const el = $(selector);
  if (!el) return;
  if (!Number.isFinite(Number(value))) {
    el.value = '';
    return;
  }
  el.value = formatValueForUnits(Number(value), units);
}

function applyLayoutPreset(presetKey) {
  const preset = presetMap[presetKey];
  if (!preset) {
    getStatus()(`Unknown layout preset: ${presetKey}`);
    return;
  }

  storedContext.enableAutoMarginMode?.(true);
  clearMarginInputs();

  const units = getCurrentUnits();
  const sheet = preset.sheet || {};
  const document = preset.document || {};
  const gutter = preset.gutter || {};
  const np = preset.nonPrintable || {};

  setValueForUnits('#sheetW', sheet.width ?? 0, units);
  setValueForUnits('#sheetH', sheet.height ?? 0, units);
  setValueForUnits('#docW', document.width ?? 0, units);
  setValueForUnits('#docH', document.height ?? 0, units);
  setValueForUnits('#gutH', gutter.horizontal ?? 0, units);
  setValueForUnits('#gutV', gutter.vertical ?? 0, units);
  setValueForUnits('#npTop', np.top ?? 0, units);
  setValueForUnits('#npRight', np.right ?? 0, units);
  setValueForUnits('#npBottom', np.bottom ?? 0, units);
  setValueForUnits('#npLeft', np.left ?? 0, units);

  const scoresApi = storedContext.scoresApi || {};
  scoresApi.lockVerticalScoreInput?.(false);
  scoresApi.lockHorizontalScoreInput?.(false);
  scoresApi.setVerticalPresetState?.('custom');
  scoresApi.setHorizontalPresetState?.('custom');
  scoresApi.setVerticalScoreOffsets?.(preset.scores?.vertical ?? []);
  scoresApi.setHorizontalScoreOffsets?.(preset.scores?.horizontal ?? []);

  const perforationsApi = storedContext.perforationsApi || {};
  perforationsApi.lockVerticalPerforationInput?.(false);
  perforationsApi.lockHorizontalPerforationInput?.(false);
  perforationsApi.setVerticalPerforationPresetState?.('custom');
  perforationsApi.setHorizontalPerforationPresetState?.('custom');
  perforationsApi.setVerticalPerforationOffsets?.(preset.perforations?.vertical ?? []);
  perforationsApi.setHorizontalPerforationOffsets?.(preset.perforations?.horizontal ?? []);

  getUpdate()();
  getStatus()(`${preset.label} preset applied`);
}

function attachPresetButtons() {
  $$('[data-layout-preset]').forEach((btn) => {
    const key = btn.dataset.layoutPreset;
    if (!key) return;
    btn.addEventListener('click', () => applyLayoutPreset(key));
  });
}

function init(context = {}) {
  hydrateTabPanel(TAB_KEY);
  storedContext = { ...storedContext, ...context };
  if (context.layoutPresets && typeof context.layoutPresets === 'object') {
    presetMap = context.layoutPresets;
  } else {
    presetMap = layoutPresets;
  }
  if (initialized) {
    return;
  }
  attachPresetButtons();
  initialized = true;
}

const presetsTab = {
  key: 'presets',
  init,
  onActivate(context) {
    init(context);
  },
  onRegister(context) {
    init(context);
  },
};

export default presetsTab;
