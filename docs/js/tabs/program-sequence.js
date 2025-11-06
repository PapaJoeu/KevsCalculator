import { hydrateTabPanel } from './registry.js';

const TAB_KEY = 'program-sequence';
let initialized = false;

function init() {
  hydrateTabPanel(TAB_KEY);
  if (initialized) return;
  initialized = true;
}

const programSequenceTab = {
  key: TAB_KEY,
  init,
  onActivate() {
    init();
  },
  onRegister() {
    init();
  },
};

export default programSequenceTab;
