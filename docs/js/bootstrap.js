import { loadFragments } from './utils/fragment-loader.js';
import { loadTemplates } from './utils/template-loader.js';

async function bootstrap() {
  await loadFragments(['app-header', 'visualizer', 'tab-nav']);
  await loadTemplates([
    'tab-inputs-template',
    'tab-presets-template',
    'tab-summary-template',
    'tab-finishing-template',
    'tab-scores-template',
    'tab-perforations-template',
    'tab-warnings-template',
    'tab-print-template',
  ]);
  await import('./app.js');
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application shell:', error);
});
