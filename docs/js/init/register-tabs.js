import { layoutPresets } from '../data/layout-presets.js';
import inputsTab, { enableAutoMarginMode, isAutoMarginModeEnabled } from '../tabs/inputs.js';
import finishingTab from '../tabs/finishing.js';
import perforationsTab from '../tabs/perforations.js';
import presetsTab from '../tabs/presets.js';
import printTab from '../tabs/print.js';
import programSequenceTab from '../tabs/program-sequence.js';
import scoresTab from '../tabs/scores.js';
import summaryTab from '../tabs/summary.js';
import warningsTab from '../tabs/warnings.js';
import { initializeTabRegistry, registerTab } from '../tabs/registry.js';

const TAB_REGISTRATIONS = ({ update, status }) => [
  { module: inputsTab, context: { update, status } },
  { module: summaryTab, context: {} },
  { module: finishingTab, context: {} },
  { module: programSequenceTab, context: {} },
  { module: scoresTab, context: { update, status } },
  { module: perforationsTab, context: { update, status } },
  { module: warningsTab, context: {} },
  { module: printTab, context: {} },
  {
    module: presetsTab,
    context: {
      update,
      status,
      enableAutoMarginMode,
      isAutoMarginModeEnabled,
      scoresApi: scoresTab.api,
      perforationsApi: perforationsTab.api,
      layoutPresets,
    },
  },
];

export function registerTabs(wiring) {
  const registrations = TAB_REGISTRATIONS(wiring);
  registrations.forEach(({ module, context }) => {
    registerTab(module.key, module, context);
    if (typeof module.init === 'function') {
      module.init(context);
    }
  });
  initializeTabRegistry();
}
