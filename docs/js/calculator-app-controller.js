import { DEFAULT_INPUTS } from './config/defaults.js';
import { registerTabs } from './init/register-tabs.js';
import { update, status } from './controllers/layout-updater.js';
import { createCalculationContext, calculateLayout } from './calculations/layout-calculations.js';
import { inchesToMillimeters } from './utils/units.js';

registerTabs({ update, status });

(function tests() {
  console.assert(inchesToMillimeters(1) === 25.4, '1 inch should be 25.4 mm');
  const ctx = createCalculationContext({
    sheet: { ...DEFAULT_INPUTS.sheet },
    document: { ...DEFAULT_INPUTS.document },
    gutter: { ...DEFAULT_INPUTS.gutter },
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    nonPrintable: { ...DEFAULT_INPUTS.nonPrintable },
  });
  const layout = calculateLayout(ctx);
  console.assert(layout.counts.across >= 1 && layout.counts.down >= 1, 'Counts should be >=1 with defaults');
})();

update();

export { update };
