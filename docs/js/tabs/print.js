import { hydrateTabPanel } from './registry.js';
import { createPrintableSvg } from '../rendering/svg-print-renderer.js';
import { inchesToMillimeters } from '../utils/units.js';

const TAB_KEY = 'print';
const DEFAULT_LAYERS = ['sheet', 'nonPrintable', 'layout', 'docs', 'cuts', 'slits', 'scores', 'perforations', 'holes'];

let initialized = false;
let panelEl = null;
let stageEl = null;
let downloadButton = null;
let printButton = null;
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
};

const fmtInches = (inches) => `${inches.toFixed(3)} in / ${inchesToMillimeters(inches).toFixed(2)} mm`;

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
  if (printButton) {
    printButton.disabled = !hasSvg;
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
  if (printButton) {
    printButton.addEventListener('click', openPrintDialog);
  }
}

function cacheElements() {
  panelEl = ensurePanel();
  if (!panelEl) return;
  stageEl = panelEl.querySelector('#printPreviewStage');
  downloadButton = panelEl.querySelector('#printDownloadSvg');
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

export function updatePrintableVisualizer({ layout, finishing, context }) {
  state.layout = layout ?? null;
  state.finishing = finishing ?? null;
  state.context = context ?? null;
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
