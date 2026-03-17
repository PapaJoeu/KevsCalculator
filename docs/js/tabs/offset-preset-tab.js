import { $ } from '../utils/dom.js';
import { hydrateTabPanel } from './registry.js';

const DEFAULT_PRESETS = {
  bifold: [0.5],
  trifold: [1 / 3, 2 / 3],
};

const formatOffsetValue = (value) => {
  const fixed = Number(value || 0).toFixed(4);
  const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
  return trimmed === '' ? '0' : trimmed;
};

function setPresetButtonState(buttons, activeKey) {
  Object.entries(buttons).forEach(([key, btn]) => {
    if (!btn) return;
    const isActive = key === activeKey;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

/**
 * Creates a tab module for offset-based preset inputs (scores, perforations).
 *
 * @param {object} config
 * @param {string} config.tabKey - Tab identifier (e.g. 'scores', 'perforations')
 * @param {string} config.featureName - Human-readable name for status messages
 * @param {object} config.presets - Map of preset key to offset arrays
 * @param {object} config.selectors - DOM selector IDs for inputs and buttons
 * @param {string} config.selectors.verticalInput
 * @param {string} config.selectors.horizontalInput
 * @param {object} config.selectors.verticalButtons - { bifold, trifold, custom }
 * @param {object} config.selectors.horizontalButtons - { bifold, trifold, custom }
 * @param {function} [config.onInit] - Optional callback after first initialization
 * @returns {{ key, init, onActivate, onRegister, api }}
 */
export function createOffsetPresetTab(config) {
  const {
    tabKey,
    featureName,
    presets = DEFAULT_PRESETS,
    selectors,
  } = config;

  let initialized = false;
  let storedContext = { update: () => {}, status: () => {} };
  let verticalInput = null;
  let horizontalInput = null;
  let verticalButtons = {};
  let horizontalButtons = {};

  const getUpdate = () => storedContext.update ?? (() => {});
  const getStatus = () => storedContext.status ?? (() => {});

  function setOffsets(input, offsets) {
    if (!input) return;
    if (!Array.isArray(offsets) || offsets.length === 0) {
      input.value = '';
      return;
    }
    input.value = offsets.map(formatOffsetValue).join(', ');
  }

  function lockInput(input, lock, presetKey) {
    if (!input) return;
    if (lock) {
      input.setAttribute('readonly', 'true');
      input.classList.add('is-locked');
      if (presetKey) input.dataset.preset = presetKey;
    } else {
      input.removeAttribute('readonly');
      input.classList.remove('is-locked');
      delete input.dataset.preset;
    }
  }

  // Public API helpers bound to vertical/horizontal
  const setVerticalOffsets = (offsets) => setOffsets(verticalInput, offsets);
  const setHorizontalOffsets = (offsets) => setOffsets(horizontalInput, offsets);
  const lockVerticalInput = (lock, presetKey) => lockInput(verticalInput, lock, presetKey);
  const lockHorizontalInput = (lock, presetKey) => lockInput(horizontalInput, lock, presetKey);
  const setVerticalPresetState = (key) => setPresetButtonState(verticalButtons, key);
  const setHorizontalPresetState = (key) => setPresetButtonState(horizontalButtons, key);

  function attachPresetHandler(buttons, direction, setOff, lockIn, setPS) {
    const label = `${direction} {{preset}} ${featureName} preset applied`;
    const customLabel = `${direction} custom ${featureName} entry enabled`;
    const inputEl = direction === 'Vertical' ? verticalInput : horizontalInput;

    Object.entries(presets).forEach(([presetKey, offsets]) => {
      buttons[presetKey]?.addEventListener('click', () => {
        setOff(offsets);
        lockIn(true, presetKey);
        setPS(presetKey);
        getUpdate()();
        getStatus()(label.replace('{{preset}}', presetKey));
      });
    });

    buttons.custom?.addEventListener('click', () => {
      lockIn(false);
      setPS('custom');
      inputEl?.focus();
      getUpdate()();
      getStatus()(customLabel);
    });
  }

  function attachInputListeners() {
    [
      { input: verticalInput, setPS: setVerticalPresetState },
      { input: horizontalInput, setPS: setHorizontalPresetState },
    ].forEach(({ input, setPS }) => {
      if (!input) return;
      ['input', 'change'].forEach((evt) =>
        input.addEventListener(evt, () => {
          if (input.readOnly) return;
          setPS('custom');
        })
      );
    });
  }

  function init(context = {}) {
    hydrateTabPanel(tabKey);
    storedContext = { ...storedContext, ...context };
    if (initialized) return;

    verticalInput = $(selectors.verticalInput);
    horizontalInput = $(selectors.horizontalInput);

    verticalButtons = {};
    horizontalButtons = {};
    for (const [key, sel] of Object.entries(selectors.verticalButtons)) {
      verticalButtons[key] = $(sel);
    }
    for (const [key, sel] of Object.entries(selectors.horizontalButtons)) {
      horizontalButtons[key] = $(sel);
    }

    attachPresetHandler(verticalButtons, 'Vertical', setVerticalOffsets, lockVerticalInput, setVerticalPresetState);
    attachPresetHandler(horizontalButtons, 'Horizontal', setHorizontalOffsets, lockHorizontalInput, setHorizontalPresetState);
    attachInputListeners();

    if (config.onInit) {
      config.onInit({ getUpdate, getStatus, verticalInput, horizontalInput });
    }

    setVerticalPresetState('custom');
    setHorizontalPresetState('custom');
    initialized = true;
  }

  return {
    key: tabKey,
    init,
    onActivate(context) { init(context); },
    onRegister(context) { init(context); },
    api: {
      setVerticalOffsets,
      setHorizontalOffsets,
      lockVerticalInput,
      lockHorizontalInput,
      setVerticalPresetState,
      setHorizontalPresetState,
    },
  };
}

export { formatOffsetValue };
