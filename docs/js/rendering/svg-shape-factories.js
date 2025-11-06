import { applyLayerAttributes } from './svg-layer-attributes.js';
import { setupMeasurementLine } from './svg-measurement-lines.js';

function addClassNames(el, classNames = []) {
  if (!classNames) return;
  if (typeof classNames === 'string') {
    if (classNames.trim()) {
      el.classList.add(...classNames.trim().split(/\s+/));
    }
    return;
  }
  if (Array.isArray(classNames) && classNames.length) {
    el.classList.add(...classNames.filter(Boolean));
  }
}

export function createRectFactory(svg, scale, offsetX, offsetY) {
  return function drawRect(x, y, width, height, { layer, classNames } = {}) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', offsetX + x * scale);
    rect.setAttribute('y', offsetY + y * scale);
    rect.setAttribute('width', Math.max(0.5, width * scale));
    rect.setAttribute('height', Math.max(0.5, height * scale));
    rect.setAttribute('rx', 6);

    addClassNames(rect, classNames);
    applyLayerAttributes(rect, layer);
    svg.appendChild(rect);
  };
}

export function createLineFactory(svg, scale, offsetX, offsetY) {
  return function drawLine(x1, y1, x2, y2, { layer, classNames, measurement } = {}) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', offsetX + x1 * scale);
    line.setAttribute('y1', offsetY + y1 * scale);
    line.setAttribute('x2', offsetX + x2 * scale);
    line.setAttribute('y2', offsetY + y2 * scale);

    line.classList.add('svg-line');
    addClassNames(line, classNames);
    applyLayerAttributes(line, layer);

    if (measurement) {
      setupMeasurementLine(line, measurement.id, measurement.type);
    }

    svg.appendChild(line);
  };
}
