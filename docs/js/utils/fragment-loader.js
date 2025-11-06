const fragmentUrl = (name) => new URL(`../partials/fragments/${name}.html`, import.meta.url);

async function fetchFragmentMarkup(name) {
  const response = await fetch(fragmentUrl(name));
  if (!response.ok) {
    throw new Error(`Failed to fetch fragment "${name}" (${response.status})`);
  }
  return response.text();
}

async function injectFragment(name) {
  if (typeof document === 'undefined') return null;
  const placeholder = document.querySelector(`[data-fragment='${name}']`);
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
