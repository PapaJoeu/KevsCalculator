const DEFAULT_TAB_KEY = 'inputs';

const tabModules = new Map();
let activeTabKey = null;
let fallbackTabKey = DEFAULT_TAB_KEY;
let isInitialized = false;

const getTabTrigger = (key) =>
  typeof document !== 'undefined'
    ? document.querySelector(`.output-tab-trigger[data-tab='${key}']`)
    : null;
const getTabPanel = (key) => (typeof document !== 'undefined' ? document.querySelector(`#tab-${key}`) : null);

const resolveTabElements = (preferredKey) => {
  const attemptKey = preferredKey ?? fallbackTabKey;
  const requestedTrigger = getTabTrigger(attemptKey);
  const requestedPanel = getTabPanel(attemptKey);
  if (requestedTrigger && requestedPanel) {
    return { key: attemptKey, trigger: requestedTrigger, panel: requestedPanel };
  }
  const fallbackTrigger = getTabTrigger(fallbackTabKey);
  const fallbackPanel = getTabPanel(fallbackTabKey);
  if (fallbackTrigger && fallbackPanel) {
    return { key: fallbackTabKey, trigger: fallbackTrigger, panel: fallbackPanel };
  }
  const firstTrigger = typeof document !== 'undefined' ? document.querySelector('.output-tab-trigger') : null;
  if (firstTrigger) {
    const firstKey = firstTrigger.dataset.tab;
    const firstPanel = getTabPanel(firstKey);
    if (firstPanel) {
      return { key: firstKey, trigger: firstTrigger, panel: firstPanel };
    }
  }
  return { key: null, trigger: null, panel: null };
};

export function registerTab(key, module, context = {}) {
  if (!key) return;
  tabModules.set(key, module ?? {});
  const registeredModule = tabModules.get(key);
  if (registeredModule && typeof registeredModule.onRegister === 'function') {
    registeredModule.onRegister({ key, activateTab, ...context });
  }
}

export function activateTab(targetKey) {
  const { key, trigger, panel } = resolveTabElements(targetKey);
  if (!key || !trigger || !panel) return;

  if (activeTabKey && activeTabKey !== key) {
    const previous = tabModules.get(activeTabKey);
    if (previous && typeof previous.onDeactivate === 'function') {
      previous.onDeactivate({ previousKey: activeTabKey, nextKey: key });
    }
  }

  if (typeof document !== 'undefined') {
    document.querySelectorAll('.output-tab-trigger').forEach((el) => el.classList.remove('is-active'));
    document.querySelectorAll('.output-tabpanel-collection>section').forEach((el) => el.classList.remove('is-active'));
  }

  trigger.classList.add('is-active');
  panel.classList.add('is-active');

  const module = tabModules.get(key);
  if (module && typeof module.onActivate === 'function') {
    module.onActivate({ key, trigger, panel });
  }

  activeTabKey = key;
}

export function initializeTabRegistry(options = {}) {
  const { defaultTab } = options;
  if (typeof defaultTab === 'string' && defaultTab.trim().length > 0) {
    fallbackTabKey = defaultTab;
  }

  if (!isInitialized && typeof document !== 'undefined') {
    document.querySelectorAll('.output-tab-trigger').forEach((trigger) => {
      trigger.addEventListener('click', () => activateTab(trigger.dataset.tab));
    });
    isInitialized = true;
  }

  const initiallyActive = typeof document !== 'undefined'
    ? document.querySelector('.output-tab-trigger.is-active')
    : null;
  const initialKey = initiallyActive?.dataset?.tab ?? fallbackTabKey;
  activateTab(initialKey);
}

export function getActiveTabKey() {
  return activeTabKey;
}

export { DEFAULT_TAB_KEY };
