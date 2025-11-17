const root = typeof globalThis !== 'undefined' ? globalThis : window;

export const DEV_ASSERTIONS_ENABLED = Boolean(root?.__DEV_ASSERTS__);

export function devAssert(condition, ...args) {
  if (!DEV_ASSERTIONS_ENABLED || typeof console === 'undefined') {
    return;
  }
  if (typeof console.assert === 'function') {
    console.assert(condition, ...args);
    return;
  }
  if (!condition) {
    console.warn('Assertion failed', ...args);
  }
}
