import { hydrateTabPanel } from './registry.js';

let initialized = false;
const TAB_KEY = 'finishing';

function init() {
  hydrateTabPanel(TAB_KEY);
  if (initialized) return;
  initialized = true;
}

const finishingTab = {
  key: 'finishing',
  init,
  onActivate() {
    init();
  },
  onRegister() {
    init();
  },
};

export default finishingTab;
