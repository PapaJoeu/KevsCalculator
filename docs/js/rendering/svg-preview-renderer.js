import { $, applyLayerVisibility, restoreMeasurementSelections } from '../utils/dom.js';
import { buildLayoutScene } from './svg-layout-scene.js';
import { createCircleFactory, createLineFactory, createRectFactory } from './svg-shape-factories.js';

export function drawSVG(layout, fin) {
  const svg = $('#svg');
  if (!svg) return;
  const scene = buildLayoutScene(layout, fin);
  const { width: viewBoxWidth, height: viewBoxHeight } = svg.viewBox.baseVal;
  const padding = 20;

  svg.innerHTML = '';

  if (!scene) return;

  const sheetWidth = scene.width;
  const sheetHeight = scene.height;

  const scaleX = (viewBoxWidth - 2 * padding) / sheetWidth;
  const scaleY = (viewBoxHeight - 2 * padding) / sheetHeight;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = padding + (viewBoxWidth - 2 * padding - sheetWidth * scale) / 2;
  const offsetY = padding + (viewBoxHeight - 2 * padding - sheetHeight * scale) / 2;

  const drawRect = createRectFactory(svg, scale, offsetX, offsetY);
  const drawLine = createLineFactory(svg, scale, offsetX, offsetY);
  const drawCircle = createCircleFactory(svg, scale, offsetX, offsetY);
  scene.items.forEach((item) => {
    if (!item) return;
    if (item.type === 'rect') {
      drawRect(item.x, item.y, item.width, item.height, {
        layer: item.layer,
        classNames: item.classNames,
        cornerRadii: item.cornerRadii,
      });
      return;
    }
    if (item.type === 'line') {
      drawLine(item.x1, item.y1, item.x2, item.y2, {
        layer: item.layer,
        classNames: item.classNames,
        measurement: item.measurement,
      });
      return;
    }
    if (item.type === 'circle') {
      drawCircle(item.cx, item.cy, item.radius, {
        layer: item.layer,
        classNames: item.classNames,
        measurement: item.measurement,
      });
    }
  });

  applyLayerVisibility();
  restoreMeasurementSelections();
}
