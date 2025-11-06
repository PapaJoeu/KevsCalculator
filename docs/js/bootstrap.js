import { loadFragments } from './utils/fragment-loader.js';
import { loadTemplates } from './utils/template-loader.js';

const collectFragmentPlaceholders = () => {
  if (typeof document === 'undefined') return [];
  const placeholders = document.querySelectorAll('[data-partial], [data-fragment]');
  const names = Array.from(placeholders, (el) => el.dataset.partial || el.dataset.fragment).filter(Boolean);
  return Array.from(new Set(names));
};

const collectTemplatePlaceholders = () => {
  if (typeof document === 'undefined') return [];
  const placeholders = document.querySelectorAll('[data-tab-template]');
  const names = Array.from(placeholders, (el) => el.dataset.tabTemplate).filter(Boolean);
  return Array.from(new Set(names));
};

async function bootstrap() {
  const fragmentNames = collectFragmentPlaceholders();
  const templateNames = collectTemplatePlaceholders();

  await loadFragments(fragmentNames);
  await loadTemplates(templateNames);
  await import('./calculator-app-controller.js');
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application shell:', error);
});
