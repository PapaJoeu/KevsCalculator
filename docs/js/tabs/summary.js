import { $$, getLayerVisibility, setLayerVisibility, applyLayerVisibility } from '../utils/dom.js';
import { initializeSummaryCalculators } from '../controllers/summary-calculators.js';
import { hydrateTabPanel } from './registry.js';

let initialized = false;
const TAB_KEY = 'summary';

function init() {
  hydrateTabPanel(TAB_KEY);
  initializeSummaryCalculators();
  if (initialized) return;
  $$('.layer-visibility-toggle-input').forEach((input) => {
    const layer = input.dataset.layer;
    if (!layer) return;
    const initial = getLayerVisibility(layer);
    input.checked = initial;
    setLayerVisibility(layer, initial);
    input.addEventListener('change', (e) => {
      setLayerVisibility(layer, e.target.checked);
    });
  });
  applyLayerVisibility();
  initialized = true;
}

const summaryTab = {
  key: 'summary',
  init,
  onActivate() {
    init();
  },
  onRegister() {
    init();
  },
};

export default summaryTab;
