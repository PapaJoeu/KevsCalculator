import { applyLayerAttributes } from './svg-layer-attributes.js';
import { setupMeasurementLine } from './svg-measurement-lines.js';
import {
  buildRoundedRectPath,
  clampCornerRadii,
  normalizeCornerRadii,
  scaleCornerRadii,
} from './rounded-rect-path.js';

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
  return function drawRect(x, y, width, height, { layer, classNames, cornerRadii } = {}) {
    const normalized = normalizeCornerRadii(cornerRadii);
    const rounded = clampCornerRadii(normalized, width, height);
    const pxX = offsetX + x * scale;
    const pxY = offsetY + y * scale;
    const pxWidth = Math.max(0.5, width * scale);
    const pxHeight = Math.max(0.5, height * scale);

    if (rounded) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const scaledRadii = scaleCornerRadii(rounded, scale);
      path.setAttribute('d', buildRoundedRectPath(pxX, pxY, pxWidth, pxHeight, scaledRadii));
      addClassNames(path, classNames);
      applyLayerAttributes(path, layer);
      svg.appendChild(path);
      return;
    }

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', pxX);
    rect.setAttribute('y', pxY);
    rect.setAttribute('width', pxWidth);
    rect.setAttribute('height', pxHeight);

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

export function createCircleFactory(svg, scale, offsetX, offsetY) {
  return function drawCircle(cx, cy, radius, { layer, classNames, measurement } = {}) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', offsetX + cx * scale);
    circle.setAttribute('cy', offsetY + cy * scale);
    circle.setAttribute('r', Math.max(0.5, radius * scale));

    addClassNames(circle, classNames);
    applyLayerAttributes(circle, layer);

    if (measurement) {
      setupMeasurementLine(circle, measurement.id, measurement.type);
    }

    svg.appendChild(circle);
  };
}
