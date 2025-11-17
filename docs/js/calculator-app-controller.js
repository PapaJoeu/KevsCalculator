import { registerTabs } from './init/register-tabs.js';
import { update, status } from './controllers/layout-updater.js';

registerTabs({ update, status });

update();

export { update };
