import { hydrateTabPanel } from './registry.js';
import { createPrintableSvg } from '../rendering/svg-print-renderer.js';
import { createLayoutDetailsSvg } from '../rendering/svg-layout-details-renderer.js';
import { calculateProgramSequence } from '../utils/program-sequence.js';
import { inchesToMillimeters, getUnitsPrecision } from '../utils/units.js';

const TAB_KEY = 'print';
const DEFAULT_LAYERS = ['sheet', 'nonPrintable', 'layout', 'docs', 'cuts', 'slits', 'scores', 'perforations', 'holes'];

let initialized = false;
let panelEl = null;
let stageEl = null;
let downloadButton = null;
let printButton = null;
let pdfButton = null;
let layoutDetailsButton = null;
const summaryEls = {
  sheet: null,
  document: null,
  counts: null,
  gutter: null,
  margins: null,
};

const state = {
  layers: new Set(DEFAULT_LAYERS),
  layout: null,
  finishing: null,
  context: null,
  programSequence: null,
};

const INCH_PRECISION = getUnitsPrecision('in');
const MILLIMETER_PRECISION = getUnitsPrecision('mm');
const fmtInches = (inches) =>
  `${inches.toFixed(INCH_PRECISION)} in / ${inchesToMillimeters(inches, MILLIMETER_PRECISION).toFixed(
    MILLIMETER_PRECISION,
  )} mm`;

function ensurePanel() {
  if (panelEl) return panelEl;
  panelEl = hydrateTabPanel(TAB_KEY);
  return panelEl;
}

function createEmptyState() {
  const container = document.createElement('div');
  container.className = 'print-preview-empty';
  container.innerHTML = `<p>The printable visualizer is ready once a layout is calculated.</p>
<p>Adjust inputs on the other tabs, then return here to export.</p>`;
  return container;
}

function updateSummary() {
  const ctx = state.context;
  const layout = state.layout;
  const hasData = Boolean(ctx && layout);

  const setText = (el, value) => {
    if (!el) return;
    el.textContent = value ?? '—';
  };

  if (!hasData) {
    setText(summaryEls.sheet, '—');
    setText(summaryEls.document, '—');
    setText(summaryEls.counts, '—');
    setText(summaryEls.gutter, '—');
    setText(summaryEls.margins, '—');
    return;
  }

  setText(
    summaryEls.sheet,
    `${fmtInches(ctx.sheet.rawWidth)} × ${fmtInches(ctx.sheet.rawHeight)}`,
  );
  setText(
    summaryEls.document,
    `${fmtInches(ctx.document.width)} × ${fmtInches(ctx.document.height)}`,
  );
  const across = layout.counts?.across ?? 0;
  const down = layout.counts?.down ?? 0;
  const total = across * down;
  setText(summaryEls.counts, `${across} × ${down} = ${total}`);
  setText(
    summaryEls.gutter,
    `${fmtInches(ctx.gutter.horizontal)} (H), ${fmtInches(ctx.gutter.vertical)} (V)`,
  );
  setText(
    summaryEls.margins,
    `T ${fmtInches(ctx.margins.top)}, R ${fmtInches(ctx.margins.right)}, B ${fmtInches(ctx.margins.bottom)}, L ${fmtInches(
      ctx.margins.left,
    )}`,
  );
}

function updateStage() {
  if (!stageEl) return;
  stageEl.innerHTML = '';
  const svg = state.layout
    ? createPrintableSvg(state.layout, state.finishing, { visibleLayers: state.layers })
    : null;
  if (!svg) {
    stageEl.appendChild(createEmptyState());
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'print-preview-sheet';
  wrapper.appendChild(svg);
  stageEl.appendChild(wrapper);
}

function updateActionState() {
  const hasSvg = Boolean(state.layout);
  if (downloadButton) {
    downloadButton.disabled = !hasSvg;
  }
  if (layoutDetailsButton) {
    layoutDetailsButton.disabled = !hasSvg;
  }
  if (printButton) {
    printButton.disabled = !hasSvg;
  }
  if (pdfButton) {
    pdfButton.disabled = !hasSvg;
  }
}

function serializeSvg(svg) {
  if (!svg) return '';
  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
}

function sanitizeFilename(value) {
  return String(value ?? '')
    .replace(/[^0-9a-zA-Z-_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function downloadSvg() {
  if (!state.layout) return;
  const svg = createPrintableSvg(state.layout, state.finishing, { visibleLayers: state.layers });
  if (!svg) return;
  const markup = serializeSvg(svg);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
  const blob = new Blob([xml], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const width = state.layout.sheet?.rawWidth ?? 0;
  const height = state.layout.sheet?.rawHeight ?? 0;
  const nameParts = ['layout', sanitizeFilename(width.toFixed(3)), sanitizeFilename(height.toFixed(3))].filter(Boolean);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${nameParts.join('-') || 'layout'}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadLayoutDetailsSvg() {
  if (!state.layout) return;
  const programSequence = state.programSequence ?? calculateProgramSequence(state.layout);
  const svg = createLayoutDetailsSvg({
    layout: state.layout,
    finishing: state.finishing,
    context: state.context,
    programSequence,
  });
  if (!svg) return;
  const markup = serializeSvg(svg);
  const width = state.layout.sheet?.rawWidth ?? 0;
  const height = state.layout.sheet?.rawHeight ?? 0;
  const nameParts = [
    'layout-details',
    sanitizeFilename(width.toFixed(3)),
    sanitizeFilename(height.toFixed(3)),
  ].filter(Boolean);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
  const blob = new Blob([xml], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${nameParts.join('-') || 'layout-details'}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadPdf() {
  if (!state.layout) return;
  const width = state.layout.sheet?.rawWidth ?? 0;
  const height = state.layout.sheet?.rawHeight ?? 0;
  if (width <= 0 || height <= 0) return;

  const visualizerSvg = createPrintableSvg(state.layout, state.finishing, { visibleLayers: state.layers });
  const programSequence = state.programSequence ?? calculateProgramSequence(state.layout);
  const detailsSvg = createLayoutDetailsSvg({
    layout: state.layout,
    finishing: state.finishing,
    context: state.context,
    programSequence,
  });

  if (!visualizerSvg || !detailsSvg) return;

  const visualizerMarkup = serializeSvg(visualizerSvg);
  const detailsMarkup = serializeSvg(detailsSvg);

  const pdfWindow = window.open('', '_blank');
  if (!pdfWindow) {
    console.warn('Unable to open PDF export window. Check your popup blocker settings.');
    return;
  }

  const styles = `@page { size: ${width}in ${height}in; margin: 0; }
body { margin: 0; background: #fff; color: #000; }
.pdf-page { width: ${width}in; height: ${height}in; display: flex; align-items: center; justify-content: center; page-break-after: always; }
.pdf-page:last-of-type { page-break-after: auto; }
.pdf-page svg { width: ${width}in; height: ${height}in; }`;

  const html = `<!DOCTYPE html><html><head><title>Layout PDF Export</title><style>${styles}</style></head><body>`
    + `<div class="pdf-page">${visualizerMarkup}</div>`
    + `<div class="pdf-page">${detailsMarkup}</div>`
    + '</body></html>';

  pdfWindow.document.write(html);
  pdfWindow.document.close();

  setTimeout(() => {
    try {
      pdfWindow.focus();
      pdfWindow.print();
    } catch (error) {
      console.warn('Unable to launch PDF print dialog', error);
    }
  }, 200);
}

function openPrintDialog() {
  if (!state.layout) return;
  const svg = createPrintableSvg(state.layout, state.finishing, { visibleLayers: state.layers });
  if (!svg) return;
  const markup = serializeSvg(svg);
  const width = state.layout.sheet?.rawWidth ?? 0;
  const height = state.layout.sheet?.rawHeight ?? 0;
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.warn('Unable to open print preview window. Check your popup blocker settings.');
    return;
  }
  const styles = `@page { size: ${width}in ${height}in; margin: 0; } body { margin: 0; background: #fff; display: flex; align-items: center; justify-content: center; } svg { width: ${width}in; height: ${height}in; }`;
  printWindow.document.write(`<!DOCTYPE html><html><head><title>Printable Layout</title><style>${styles}</style></head><body>${markup}</body></html>`);
  printWindow.document.close();
  setTimeout(() => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch (error) {
      console.warn('Unable to launch print dialog', error);
    }
  }, 150);
}

function bindEvents() {
  if (!panelEl) return;
  panelEl.querySelectorAll('.print-layer-toggle').forEach((input) => {
    const layer = input.dataset.layer;
    if (!layer) return;
    input.checked = state.layers.has(layer);
    input.addEventListener('change', (event) => {
      if (event.target.checked) {
        state.layers.add(layer);
      } else {
        state.layers.delete(layer);
      }
      updateStage();
    });
  });

  if (downloadButton) {
    downloadButton.addEventListener('click', downloadSvg);
  }
  if (layoutDetailsButton) {
    layoutDetailsButton.addEventListener('click', downloadLayoutDetailsSvg);
  }
  if (pdfButton) {
    pdfButton.addEventListener('click', downloadPdf);
  }
  if (printButton) {
    printButton.addEventListener('click', openPrintDialog);
  }
}

function cacheElements() {
  panelEl = ensurePanel();
  if (!panelEl) return;
  stageEl = panelEl.querySelector('#printPreviewStage');
  downloadButton = panelEl.querySelector('#printDownloadSvg');
  layoutDetailsButton = panelEl.querySelector('#printDownloadLayoutDetails');
  pdfButton = panelEl.querySelector('#printDownloadPdf');
  printButton = panelEl.querySelector('#printOpenPrintDialog');
  summaryEls.sheet = panelEl.querySelector('#printSheetSummary');
  summaryEls.document = panelEl.querySelector('#printDocumentSummary');
  summaryEls.counts = panelEl.querySelector('#printCountsSummary');
  summaryEls.gutter = panelEl.querySelector('#printGutterSummary');
  summaryEls.margins = panelEl.querySelector('#printMarginSummary');
}

function init() {
  ensurePanel();
  if (initialized || !panelEl) return;
  cacheElements();
  bindEvents();
  updateSummary();
  updateStage();
  updateActionState();
  initialized = true;
}

export function updatePrintableVisualizer({ layout, finishing, context, programSequence }) {
  state.layout = layout ?? null;
  state.finishing = finishing ?? null;
  state.context = context ?? null;
  state.programSequence = programSequence ?? null;
  if (!initialized) {
    ensurePanel();
    cacheElements();
  }
  updateSummary();
  updateStage();
  updateActionState();
}

const printTab = {
  key: TAB_KEY,
  init,
  onActivate() {
    init();
  },
  onRegister() {
    init();
  },
};

export default printTab;
