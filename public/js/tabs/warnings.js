import { hydrateTabPanel } from './registry.js';

let initialized = false;
const TAB_KEY = 'warnings';

function init() {
  hydrateTabPanel(TAB_KEY);
  if (initialized) return;
  initialized = true;
}

const warningsTab = {
  key: 'warnings',
  init,
  onActivate() {
    init();
  },
  onRegister() {
    init();
  },
};

export default warningsTab;
