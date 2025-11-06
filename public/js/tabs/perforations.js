import { $ } from '../utils/dom.js';

const PERFORATION_PRESETS = {
  bifold: [0.5],
  trifold: [1 / 3, 2 / 3],
};

let initialized = false;
let storedContext = { update: () => {}, status: () => {} };
let verticalPerforationInput = null;
let horizontalPerforationInput = null;
let verticalPerforationPresetButtons = {};
let horizontalPerforationPresetButtons = {};

const getUpdate = () => storedContext.update ?? (() => {});
const getStatus = () => storedContext.status ?? (() => {});

const formatOffsetValue = (value) => {
  const fixed = Number(value || 0).toFixed(4);
  const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
  return trimmed === '' ? '0' : trimmed;
};

function setScorePresetState(buttons, activeKey) {
  Object.entries(buttons).forEach(([key, btn]) => {
    if (!btn) return;
    const isActive = key === activeKey;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function setVerticalPerforationOffsets(offsets = []) {
  if (!verticalPerforationInput) return;
  if (!Array.isArray(offsets) || offsets.length === 0) {
    verticalPerforationInput.value = '';
    return;
  }
  verticalPerforationInput.value = offsets.map(formatOffsetValue).join(', ');
}

function lockVerticalPerforationInput(lock, presetKey) {
  if (!verticalPerforationInput) return;
  if (lock) {
    verticalPerforationInput.setAttribute('readonly', 'true');
    verticalPerforationInput.classList.add('is-locked');
    if (presetKey) verticalPerforationInput.dataset.preset = presetKey;
  } else {
    verticalPerforationInput.removeAttribute('readonly');
    verticalPerforationInput.classList.remove('is-locked');
    delete verticalPerforationInput.dataset.preset;
  }
}

function setVerticalPerforationPresetState(key) {
  setScorePresetState(verticalPerforationPresetButtons, key);
}

function setHorizontalPerforationOffsets(offsets = []) {
  if (!horizontalPerforationInput) return;
  if (!Array.isArray(offsets) || offsets.length === 0) {
    horizontalPerforationInput.value = '';
    return;
  }
  horizontalPerforationInput.value = offsets.map(formatOffsetValue).join(', ');
}

function lockHorizontalPerforationInput(lock, presetKey) {
  if (!horizontalPerforationInput) return;
  if (lock) {
    horizontalPerforationInput.setAttribute('readonly', 'true');
    horizontalPerforationInput.classList.add('is-locked');
    if (presetKey) horizontalPerforationInput.dataset.preset = presetKey;
  } else {
    horizontalPerforationInput.removeAttribute('readonly');
    horizontalPerforationInput.classList.remove('is-locked');
    delete horizontalPerforationInput.dataset.preset;
  }
}

function setHorizontalPerforationPresetState(key) {
  setScorePresetState(horizontalPerforationPresetButtons, key);
}

function attachPresetButtonHandlers() {
  verticalPerforationPresetButtons = {
    bifold: $('#perfPresetVBifold'),
    trifold: $('#perfPresetVTrifold'),
    custom: $('#perfPresetVCustom'),
  };
  horizontalPerforationPresetButtons = {
    bifold: $('#perfPresetHBifold'),
    trifold: $('#perfPresetHTrifold'),
    custom: $('#perfPresetHCustom'),
  };

  verticalPerforationPresetButtons.bifold?.addEventListener('click', () => {
    setVerticalPerforationOffsets(PERFORATION_PRESETS.bifold);
    lockVerticalPerforationInput(true, 'bifold');
    setVerticalPerforationPresetState('bifold');
    getUpdate()();
    getStatus()('Vertical bifold perforation preset applied');
  });

  verticalPerforationPresetButtons.trifold?.addEventListener('click', () => {
    setVerticalPerforationOffsets(PERFORATION_PRESETS.trifold);
    lockVerticalPerforationInput(true, 'trifold');
    setVerticalPerforationPresetState('trifold');
    getUpdate()();
    getStatus()('Vertical trifold perforation preset applied');
  });

  verticalPerforationPresetButtons.custom?.addEventListener('click', () => {
    lockVerticalPerforationInput(false);
    setVerticalPerforationPresetState('custom');
    verticalPerforationInput?.focus();
    getUpdate()();
    getStatus()('Vertical custom perforation entry enabled');
  });

  horizontalPerforationPresetButtons.bifold?.addEventListener('click', () => {
    setHorizontalPerforationOffsets(PERFORATION_PRESETS.bifold);
    lockHorizontalPerforationInput(true, 'bifold');
    setHorizontalPerforationPresetState('bifold');
    getUpdate()();
    getStatus()('Horizontal bifold perforation preset applied');
  });

  horizontalPerforationPresetButtons.trifold?.addEventListener('click', () => {
    setHorizontalPerforationOffsets(PERFORATION_PRESETS.trifold);
    lockHorizontalPerforationInput(true, 'trifold');
    setHorizontalPerforationPresetState('trifold');
    getUpdate()();
    getStatus()('Horizontal trifold perforation preset applied');
  });

  horizontalPerforationPresetButtons.custom?.addEventListener('click', () => {
    lockHorizontalPerforationInput(false);
    setHorizontalPerforationPresetState('custom');
    horizontalPerforationInput?.focus();
    getUpdate()();
    getStatus()('Horizontal custom perforation entry enabled');
  });
}

function attachInputListeners() {
  if (verticalPerforationInput) {
    ['input', 'change'].forEach((evt) =>
      verticalPerforationInput.addEventListener(evt, () => {
        if (verticalPerforationInput.readOnly) return;
        setVerticalPerforationPresetState('custom');
      })
    );
  }
  if (horizontalPerforationInput) {
    ['input', 'change'].forEach((evt) =>
      horizontalPerforationInput.addEventListener(evt, () => {
        if (horizontalPerforationInput.readOnly) return;
        setHorizontalPerforationPresetState('custom');
      })
    );
  }
}

function init(context = {}) {
  if (initialized) {
    storedContext = { ...storedContext, ...context };
    return;
  }
  storedContext = { ...storedContext, ...context };
  verticalPerforationInput = $('#perfV');
  horizontalPerforationInput = $('#perfH');

  attachPresetButtonHandlers();
  attachInputListeners();

  setVerticalPerforationPresetState('custom');
  setHorizontalPerforationPresetState('custom');
  initialized = true;
}

const perforationsTab = {
  key: 'perforations',
  init,
  onActivate(context) {
    init(context);
  },
  onRegister(context) {
    init(context);
  },
  api: {
    setVerticalPerforationOffsets,
    setHorizontalPerforationOffsets,
    lockVerticalPerforationInput,
    lockHorizontalPerforationInput,
    setVerticalPerforationPresetState,
    setHorizontalPerforationPresetState,
  },
};

export default perforationsTab;
