import {
  isMeasurementSelected,
  registerMeasurementId,
  setMeasurementHover,
  toggleMeasurementSelection,
} from '../utils/dom.js';

export function setupMeasurementLine(lineElement, measureId, measureType) {
  if (!measureId) return;

  registerMeasurementId(measureId);
  lineElement.dataset.measureId = measureId;
  lineElement.classList.add('measurement-line');

  if (measureType) {
    lineElement.dataset.measureType = measureType;
  }

  if (isMeasurementSelected(measureId)) {
    lineElement.classList.add('is-selected');
  }

  lineElement.addEventListener('mouseenter', () => setMeasurementHover(measureId, true));
  lineElement.addEventListener('mouseleave', () => setMeasurementHover(measureId, false));
  lineElement.addEventListener('click', () => toggleMeasurementSelection(measureId));
}
