/**
 * Lazy template loader supporting tab hydration.
 *
 * Adding a new tab/template:
 *   1. Save the markup under docs/partials/templates/<name>.html with a
 *      <template id="name"> wrapper and documentation block.
 *   2. Reference the template from the corresponding tab panel via
 *      data-tab-template="name" in index.html (or another container).
 *   3. Ensure the tab module calls hydrateTabPanel('<tab-key>') so the registry
 *      clones the template before attaching event handlers.
 */
const templateUrl = (name) => new URL(`../partials/templates/${name}.html`, import.meta.url);

async function fetchTemplateMarkup(name) {
  const response = await fetch(templateUrl(name));
  if (!response.ok) {
    throw new Error(`Failed to fetch template "${name}" (${response.status})`);
  }
  return response.text();
}

function extractTemplateElement(markup) {
  if (typeof document === 'undefined') return null;
  const container = document.createElement('div');
  container.innerHTML = markup.trim();
  return container.querySelector('template');
}

const ensureTemplateHost = () => {
  if (typeof document === 'undefined') return null;
  let host = document.querySelector('[data-template-host]');
  if (!host) {
    host = document.createElement('div');
    host.hidden = true;
    host.setAttribute('data-template-host', '');
    document.body.appendChild(host);
  }
  return host;
};

async function injectTemplate(name) {
  if (typeof document === 'undefined') return null;
  const existing = document.getElementById(name);
  if (existing) {
    return existing;
  }
  try {
    const markup = await fetchTemplateMarkup(name);
    const template = extractTemplateElement(markup);
    if (!template) {
      throw new Error(`Template "${name}" did not include a <template> element.`);
    }
    const host = ensureTemplateHost();
    if (!host) {
      throw new Error('Unable to locate or create template host container.');
    }
    host.appendChild(template);
    return template;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function loadTemplates(names = []) {
  const tasks = names.map((name) => injectTemplate(name));
  await Promise.all(tasks);
}
