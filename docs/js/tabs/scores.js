import { $, parseOffsets } from '../utils/dom.js';
import { createOffsetPresetTab } from './offset-preset-tab.js';

const tab = createOffsetPresetTab({
  tabKey: 'scores',
  featureName: 'score',
  selectors: {
    verticalInput: '#scoresV',
    horizontalInput: '#scoresH',
    verticalButtons: {
      bifold: '#scorePresetBifold',
      trifold: '#scorePresetTrifold',
      custom: '#scorePresetCustom',
    },
    horizontalButtons: {
      bifold: '#scorePresetHBifold',
      trifold: '#scorePresetHTrifold',
      custom: '#scorePresetHCustom',
    },
  },
  onInit({ getUpdate, getStatus, verticalInput, horizontalInput }) {
    $('#swapScoreOffsets')?.addEventListener('click', () => {
      if (!verticalInput || !horizontalInput) return;
      const vOffsets = parseOffsets(verticalInput.value);
      const hOffsets = parseOffsets(horizontalInput.value);

      tab.api.lockVerticalInput(false);
      tab.api.lockHorizontalInput(false);
      tab.api.setVerticalPresetState('custom');
      tab.api.setHorizontalPresetState('custom');
      tab.api.setVerticalOffsets(hOffsets);
      tab.api.setHorizontalOffsets(vOffsets);

      getUpdate()();
      getStatus()('Swapped vertical and horizontal score offsets');
    });
  },
});

// Re-export the api under the original names expected by presets.js
const scoresTab = {
  ...tab,
  api: {
    setVerticalScoreOffsets: tab.api.setVerticalOffsets,
    setHorizontalScoreOffsets: tab.api.setHorizontalOffsets,
    lockVerticalScoreInput: tab.api.lockVerticalInput,
    lockHorizontalScoreInput: tab.api.lockHorizontalInput,
    setVerticalPresetState: tab.api.setVerticalPresetState,
    setHorizontalPresetState: tab.api.setHorizontalPresetState,
  },
};

export default scoresTab;
