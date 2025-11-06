/**
 * Lazy fragment loader used by docs/js/bootstrap.js.
 *
 * Adding a new fragment:
 *   1. Create docs/html-partials/fragments/<name>.html with the desired markup and
 *      documentation block.
 *   2. Place a placeholder element in index.html (or another host file) with
 *      data-partial="name" (or data-fragment="name") where the fragment should
 *      render.
 *   3. No further wiring is needed—bootstrap collects the placeholder names and
 *      loadFragments() injects the markup before app.js initializes.
 */
const fragmentUrl = (name) => new URL(`../../html-partials/fragments/${name}.html`, import.meta.url);

async function fetchFragmentMarkup(name) {
  const response = await fetch(fragmentUrl(name));
  if (!response.ok) {
    throw new Error(`Failed to fetch fragment "${name}" (${response.status})`);
  }
  return response.text();
}

const selectFragmentPlaceholder = (name) =>
  typeof document !== 'undefined'
    ? document.querySelector(`[data-partial='${name}'], [data-fragment='${name}']`)
    : null;

async function injectFragment(name) {
  if (typeof document === 'undefined') return null;
  const placeholder = selectFragmentPlaceholder(name);
  if (!placeholder) return null;

  try {
    const html = await fetchFragmentMarkup(name);
    placeholder.insertAdjacentHTML('beforebegin', html);
    placeholder.remove();
    return name;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function loadFragments(names = []) {
  const tasks = names.map((name) => injectFragment(name));
  await Promise.all(tasks);
}
