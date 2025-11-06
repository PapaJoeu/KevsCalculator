import { hydrateTabPanel } from './registry.js';

let initialized = false;
const TAB_KEY = 'print';

function init() {
  hydrateTabPanel(TAB_KEY);
  if (initialized) return;
  initialized = true;
}

const printTab = {
  key: 'print',
  init,
  onActivate() {
    init();
  },
  onRegister() {
    init();
  },
};

export default printTab;
