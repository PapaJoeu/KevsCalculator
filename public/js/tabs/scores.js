import { $, parseOffsets } from '../utils/dom.js';

const SCORE_PRESETS = {
  bifold: [0.5],
  trifold: [1 / 3, 2 / 3],
};

let initialized = false;
let storedContext = { update: () => {}, status: () => {} };
let verticalScoreInput = null;
let horizontalScoreInput = null;
let verticalScorePresetButtons = {};
let horizontalScorePresetButtons = {};

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

function setVerticalScoreOffsets(offsets = []) {
  if (!verticalScoreInput) return;
  if (!Array.isArray(offsets) || offsets.length === 0) {
    verticalScoreInput.value = '';
    return;
  }
  verticalScoreInput.value = offsets.map(formatOffsetValue).join(', ');
}

function lockVerticalScoreInput(lock, presetKey) {
  if (!verticalScoreInput) return;
  if (lock) {
    verticalScoreInput.setAttribute('readonly', 'true');
    verticalScoreInput.classList.add('is-locked');
    if (presetKey) verticalScoreInput.dataset.preset = presetKey;
  } else {
    verticalScoreInput.removeAttribute('readonly');
    verticalScoreInput.classList.remove('is-locked');
    delete verticalScoreInput.dataset.preset;
  }
}

function setVerticalPresetState(key) {
  setScorePresetState(verticalScorePresetButtons, key);
}

function setHorizontalScoreOffsets(offsets = []) {
  if (!horizontalScoreInput) return;
  if (!Array.isArray(offsets) || offsets.length === 0) {
    horizontalScoreInput.value = '';
    return;
  }
  horizontalScoreInput.value = offsets.map(formatOffsetValue).join(', ');
}

function lockHorizontalScoreInput(lock, presetKey) {
  if (!horizontalScoreInput) return;
  if (lock) {
    horizontalScoreInput.setAttribute('readonly', 'true');
    horizontalScoreInput.classList.add('is-locked');
    if (presetKey) horizontalScoreInput.dataset.preset = presetKey;
  } else {
    horizontalScoreInput.removeAttribute('readonly');
    horizontalScoreInput.classList.remove('is-locked');
    delete horizontalScoreInput.dataset.preset;
  }
}

function setHorizontalPresetState(key) {
  setScorePresetState(horizontalScorePresetButtons, key);
}

function swapScoreOffsets() {
  if (!verticalScoreInput || !horizontalScoreInput) return;
  const verticalOffsets = parseOffsets(verticalScoreInput.value);
  const horizontalOffsets = parseOffsets(horizontalScoreInput.value);

  lockVerticalScoreInput(false);
  lockHorizontalScoreInput(false);
  setVerticalPresetState('custom');
  setHorizontalPresetState('custom');

  setVerticalScoreOffsets(horizontalOffsets);
  setHorizontalScoreOffsets(verticalOffsets);

  getUpdate()();
  getStatus()('Swapped vertical and horizontal score offsets');
}

function attachPresetButtonHandlers() {
  verticalScorePresetButtons = {
    bifold: $('#scorePresetBifold'),
    trifold: $('#scorePresetTrifold'),
    custom: $('#scorePresetCustom'),
  };
  horizontalScorePresetButtons = {
    bifold: $('#scorePresetHBifold'),
    trifold: $('#scorePresetHTrifold'),
    custom: $('#scorePresetHCustom'),
  };

  verticalScorePresetButtons.bifold?.addEventListener('click', () => {
    setVerticalScoreOffsets(SCORE_PRESETS.bifold);
    lockVerticalScoreInput(true, 'bifold');
    setVerticalPresetState('bifold');
    getUpdate()();
    getStatus()('Vertical bifold score preset applied');
  });

  verticalScorePresetButtons.trifold?.addEventListener('click', () => {
    setVerticalScoreOffsets(SCORE_PRESETS.trifold);
    lockVerticalScoreInput(true, 'trifold');
    setVerticalPresetState('trifold');
    getUpdate()();
    getStatus()('Vertical trifold score preset applied');
  });

  verticalScorePresetButtons.custom?.addEventListener('click', () => {
    lockVerticalScoreInput(false);
    setVerticalPresetState('custom');
    verticalScoreInput?.focus();
    getUpdate()();
    getStatus()('Vertical custom score entry enabled');
  });

  horizontalScorePresetButtons.bifold?.addEventListener('click', () => {
    setHorizontalScoreOffsets(SCORE_PRESETS.bifold);
    lockHorizontalScoreInput(true, 'bifold');
    setHorizontalPresetState('bifold');
    getUpdate()();
    getStatus()('Horizontal bifold score preset applied');
  });

  horizontalScorePresetButtons.trifold?.addEventListener('click', () => {
    setHorizontalScoreOffsets(SCORE_PRESETS.trifold);
    lockHorizontalScoreInput(true, 'trifold');
    setHorizontalPresetState('trifold');
    getUpdate()();
    getStatus()('Horizontal trifold score preset applied');
  });

  horizontalScorePresetButtons.custom?.addEventListener('click', () => {
    lockHorizontalScoreInput(false);
    setHorizontalPresetState('custom');
    horizontalScoreInput?.focus();
    getUpdate()();
    getStatus()('Horizontal custom score entry enabled');
  });
}

function attachInputListeners() {
  if (verticalScoreInput) {
    ['input', 'change'].forEach((evt) =>
      verticalScoreInput.addEventListener(evt, () => {
        if (verticalScoreInput.readOnly) return;
        setVerticalPresetState('custom');
      })
    );
  }
  if (horizontalScoreInput) {
    ['input', 'change'].forEach((evt) =>
      horizontalScoreInput.addEventListener(evt, () => {
        if (horizontalScoreInput.readOnly) return;
        setHorizontalPresetState('custom');
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
  verticalScoreInput = $('#scoresV');
  horizontalScoreInput = $('#scoresH');

  attachPresetButtonHandlers();
  attachInputListeners();
  $('#swapScoreOffsets')?.addEventListener('click', swapScoreOffsets);

  setVerticalPresetState('custom');
  setHorizontalPresetState('custom');
  initialized = true;
}

const scoresTab = {
  key: 'scores',
  init,
  onActivate(context) {
    init(context);
  },
  onRegister(context) {
    init(context);
  },
  api: {
    setVerticalScoreOffsets,
    setHorizontalScoreOffsets,
    lockVerticalScoreInput,
    lockHorizontalScoreInput,
    setVerticalPresetState,
    setHorizontalPresetState,
  },
};

export default scoresTab;
