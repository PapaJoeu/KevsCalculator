import { loadFragments } from './utils/fragment-loader.js';

async function bootstrap() {
  await loadFragments(['app-header', 'visualizer', 'tab-nav']);
  await import('./app.js');
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application shell:', error);
});
