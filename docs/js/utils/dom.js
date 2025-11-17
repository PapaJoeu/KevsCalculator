import { inchesToMillimeters, DISPLAY_MILLIMETERS_PRECISION } from './units.js';

export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const layerVisibility = {
  layout: true,
  docs: true,
  nonPrintable: true,
  cuts: true,
  slits: true,
  scores: true,
  perforations: true,
  holes: true,
};

const selectedMeasurements = new Set();
let currentMeasurementIds = new Set();

export const createMeasurementId = (type, index) => `${type}-${index}`;

export const registerMeasurementId = (id) => {
  if (!id) return;
  currentMeasurementIds.add(id);
};

const measurementElements = (id) => $$(`[data-measure-id="${id}"]`);

export const setMeasurementHover = (id, hovered) => {
  measurementElements(id).forEach((el) => el.classList.toggle('is-hovered', hovered));
};

const setMeasurementSelectionClass = (id, selected) => {
  measurementElements(id).forEach((el) => el.classList.toggle('is-selected', selected));
};

export const toggleMeasurementSelection = (id) => {
  if (!id) return;
  const willSelect = !selectedMeasurements.has(id);
  if (willSelect) {
    selectedMeasurements.add(id);
  } else {
    selectedMeasurements.delete(id);
  }
  setMeasurementSelectionClass(id, willSelect);
};

export const attachMeasurementRowInteractions = (row) => {
  if (!row) return;
  const id = row.dataset.measureId;
  if (!id) return;
  row.setAttribute('tabindex', '0');
  row.addEventListener('mouseenter', () => setMeasurementHover(id, true));
  row.addEventListener('mouseleave', () => setMeasurementHover(id, false));
  row.addEventListener('click', () => toggleMeasurementSelection(id));
  row.addEventListener('focus', () => setMeasurementHover(id, true));
  row.addEventListener('blur', () => setMeasurementHover(id, false));
  row.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      toggleMeasurementSelection(id);
    }
  });
};

export const isMeasurementSelected = (id) => selectedMeasurements.has(id);

export const resetMeasurementRegistry = () => {
  currentMeasurementIds = new Set();
};

export const restoreMeasurementSelections = () => {
  const stale = [];
  selectedMeasurements.forEach((id) => {
    if (!currentMeasurementIds.has(id)) {
      stale.push(id);
      return;
    }
    setMeasurementSelectionClass(id, true);
  });
  stale.forEach((id) => selectedMeasurements.delete(id));
};

export const applyLayerVisibility = () => {
  const svg = $('#svg');
  if (!svg) return;
  Object.entries(layerVisibility).forEach(([layer, visible]) => {
    svg.querySelectorAll(`[data-layer="${layer}"]`).forEach((el) => {
      el.style.display = visible ? '' : 'none';
    });
  });
};

export const setLayerVisibility = (layer, visible) => {
  if (!(layer in layerVisibility)) return;
  layerVisibility[layer] = Boolean(visible);
  applyLayerVisibility();
};

export const getLayerVisibility = (layer) => layerVisibility[layer] ?? true;

const formatDisplayValue = (value, precision) => {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(precision);
};

export const fillTable = (tbody, rows, type = 'measure') => {
  if (!tbody) return;
  const mmPrecision = DISPLAY_MILLIMETERS_PRECISION;
  tbody.innerHTML = rows
    .map((row, index) => {
      const id = createMeasurementId(type, index);
      registerMeasurementId(id);
      const cells = [
        `<td>${row.label}</td>`,
        `<td class="k">${formatDisplayValue(row.inches, 3)}</td>`,
        `<td class="k">${formatDisplayValue(row.millimeters, mmPrecision)}</td>`,
      ];
      return `<tr class="viz-measure-row" data-measure-id="${id}" data-measure-type="${type}" data-measure-index="${index}">${cells.join('')}</tr>`;
    })
    .join('');
  tbody.querySelectorAll('tr[data-measure-id]').forEach((row) => {
    attachMeasurementRowInteractions(row);
    if (isMeasurementSelected(row.dataset.measureId)) {
      row.classList.add('is-selected');
    }
  });
};

export const fillHoleTable = (tbody, holes = []) => {
  if (!tbody) return;
  const rows = Array.isArray(holes) ? holes : [];
  const mmPrecision = DISPLAY_MILLIMETERS_PRECISION;
  tbody.innerHTML = rows
    .map((hole, index) => {
      const id = createMeasurementId('hole', index);
      registerMeasurementId(id);
      const label = hole?.label ?? `Hole ${index + 1}`;
      const x = Number(hole?.x ?? 0);
      const y = Number(hole?.y ?? 0);
      const diameter = Math.max(0, Number(hole?.diameter ?? 0));
      const mmX = inchesToMillimeters(x, mmPrecision);
      const mmY = inchesToMillimeters(y, mmPrecision);
      const mmDiameter = inchesToMillimeters(diameter, mmPrecision);
      const cells = [
        `<td>${label}</td>`,
        `<td class="k">${formatDisplayValue(x, 3)}</td>`,
        `<td class="k">${formatDisplayValue(y, 3)}</td>`,
        `<td class="k">${formatDisplayValue(diameter, 3)}</td>`,
        `<td class="k">${formatDisplayValue(mmX, mmPrecision)}</td>`,
        `<td class="k">${formatDisplayValue(mmY, mmPrecision)}</td>`,
        `<td class="k">${formatDisplayValue(mmDiameter, mmPrecision)}</td>`,
      ];
      return `<tr class="viz-measure-row" data-measure-id="${id}" data-measure-type="hole" data-measure-index="${index}">${cells.join('')}</tr>`;
    })
    .join('');
  tbody.querySelectorAll('tr[data-measure-id]').forEach((row) => {
    attachMeasurementRowInteractions(row);
    if (isMeasurementSelected(row.dataset.measureId)) {
      row.classList.add('is-selected');
    }
  });
};

export const readNumber = (selector) => {
  const el = $(selector);
  const value = el?.value ?? '';
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const readIntOptional = (selector) => {
  const el = $(selector);
  const raw = (el?.value || '').trim();
  if (el?.dataset?.autoActive === 'true') {
    return null;
  }
  if (raw === '') return null;
  const n = Math.max(1, Math.floor(Number(raw)));
  return Number.isFinite(n) ? n : null;
};

export const parseOffsets = (value) =>
  (value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
