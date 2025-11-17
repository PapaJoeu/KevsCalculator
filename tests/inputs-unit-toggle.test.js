import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setMeasurementInput, convertInputs } from '../docs/js/tabs/inputs.js';

class MockInput {
  constructor(selector, options = {}) {
    this.selector = selector;
    this.dataset = { ...options.dataset };
    this.value = options.value ?? '';
    this.attributes = new Map();
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        this.setAttribute(key, value);
      });
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }
}

describe('inputs tab unit toggle regression', () => {
  let elements;
  beforeEach(() => {
    elements = new Map();
    global.document = {
      querySelector: (selector) => elements.get(selector) ?? null,
      querySelectorAll: () => [],
    };
  });

  afterEach(() => {
    delete global.document;
  });

  it('preserves numeric values and steps when converting units back and forth', () => {
    const selectors = ['#docW', '#docH', '#gutH'];
    selectors.forEach((selector) => {
      elements.set(
        selector,
        new MockInput(selector, {
          dataset: { inchStep: '0.125', inchMin: '0.25', inchMax: '24' },
          attributes: { step: '0.125', min: '0.25', max: '24' },
        })
      );
    });

    setMeasurementInput('#docW', 3.5, 'in');
    setMeasurementInput('#docH', 2, 'in');
    setMeasurementInput('#gutH', 0.125, 'in');

    const snapshot = selectors.map((selector) => {
      const el = elements.get(selector);
      return { selector, value: el.value, step: el.getAttribute('step') };
    });

    convertInputs('in', 'mm');
    convertInputs('mm', 'in');

    snapshot.forEach(({ selector, value, step }) => {
      const el = elements.get(selector);
      expect(el.value).toBe(value);
      expect(el.getAttribute('step')).toBe(step);
    });
  });
});
