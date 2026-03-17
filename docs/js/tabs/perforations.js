import { createOffsetPresetTab } from './offset-preset-tab.js';

const tab = createOffsetPresetTab({
  tabKey: 'perforations',
  featureName: 'perforation',
  selectors: {
    verticalInput: '#perfV',
    horizontalInput: '#perfH',
    verticalButtons: {
      bifold: '#perfPresetVBifold',
      trifold: '#perfPresetVTrifold',
      custom: '#perfPresetVCustom',
    },
    horizontalButtons: {
      bifold: '#perfPresetHBifold',
      trifold: '#perfPresetHTrifold',
      custom: '#perfPresetHCustom',
    },
  },
});

// Re-export the api under the original names expected by presets.js
const perforationsTab = {
  ...tab,
  api: {
    setVerticalPerforationOffsets: tab.api.setVerticalOffsets,
    setHorizontalPerforationOffsets: tab.api.setHorizontalOffsets,
    lockVerticalPerforationInput: tab.api.lockVerticalInput,
    lockHorizontalPerforationInput: tab.api.lockHorizontalInput,
    setVerticalPerforationPresetState: tab.api.setVerticalPresetState,
    setHorizontalPerforationPresetState: tab.api.setHorizontalPresetState,
  },
};

export default perforationsTab;
