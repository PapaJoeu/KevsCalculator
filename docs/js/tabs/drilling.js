import { $ } from '../utils/dom.js';
import { hydrateTabPanel } from './registry.js';

const TAB_KEY = 'drilling';

const EDGE_OPTIONS = [
  { value: 'top', label: 'Top edge' },
  { value: 'bottom', label: 'Bottom edge' },
  { value: 'left', label: 'Left edge' },
  { value: 'right', label: 'Right edge' },
];

const ALIGN_LABELS = {
  top: { start: 'Left', center: 'Center', end: 'Right' },
  bottom: { start: 'Left', center: 'Center', end: 'Right' },
  left: { start: 'Top', center: 'Center', end: 'Bottom' },
  right: { start: 'Top', center: 'Center', end: 'Bottom' },
};

const VALID_PRESETS = new Set(['none', 'three-hole', 'custom']);
const VALID_ALIGNS = new Set(['start', 'center', 'end']);

const HOLE_SIZE_LABELS = new Map([
  ['0.25', '1/4 in (0.250)'],
  ['0.1875', '3/16 in (0.1875)'],
  ['0.3125', '5/16 in (0.3125)'],
  ['0.375', '3/8 in (0.375)'],
]);

const DEFAULT_CUSTOM_ENTRY = {
  edge: 'top',
  align: 'center',
  axisOffset: 0,
  offset: 0.25,
};

const PRESET_GENERATORS = {
  none: () => [],
  'three-hole': () => [
    { edge: 'left', align: 'start', axisOffset: 0.5, offset: 0.3125 },
    { edge: 'left', align: 'center', axisOffset: 0, offset: 0.3125 },
    { edge: 'left', align: 'end', axisOffset: 0.5, offset: 0.3125 },
  ],
  custom: (entries = []) => (entries.length ? entries : [DEFAULT_CUSTOM_ENTRY]),
};

let initialized = false;
let storedContext = { update: () => {}, status: () => {} };
let elements = {};
let currentConfig = {
  preset: 'none',
  size: 0.25,
  entries: [],
};

const getUpdate = () => storedContext.update ?? (() => {});
const getStatus = () => storedContext.status ?? (() => {});

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeEntry = (entry = {}) => {
  const edge = EDGE_OPTIONS.some((opt) => opt.value === entry.edge) ? entry.edge : 'left';
  const align = VALID_ALIGNS.has(entry.align) ? entry.align : 'center';
  const axisOffset = toNumber(entry.axisOffset, 0);
  const offset = Math.max(0, toNumber(entry.offset, 0));
  return { edge, align, axisOffset, offset };
};

const resolvePresetEntries = (preset, entries = []) => {
  const generator = PRESET_GENERATORS[preset] ?? PRESET_GENERATORS.none;
  const generated = generator(entries).map(normalizeEntry);
  return generated;
};

const normalizeConfig = (config = {}) => {
  const preset = VALID_PRESETS.has(config.preset) ? config.preset : 'none';
  const size = toNumber(config.size, currentConfig.size ?? 0.25);
  const diameter = size > 0 ? size : 0.25;
  const rawEntries = Array.isArray(config.entries) ? config.entries : [];
  const entries = preset === 'custom' ? rawEntries.map(normalizeEntry) : resolvePresetEntries(preset);
  return { preset, size: diameter, entries };
};

const setHiddenValue = () => {
  if (!elements.hiddenInput) return;
  try {
    elements.hiddenInput.value = JSON.stringify(currentConfig);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to serialize drilling config', error);
  }
};

const toggleCustomContainer = (show) => {
  if (!elements.customContainer) return;
  elements.customContainer.hidden = !show;
};

const createOption = (value, label) => {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
};

const updateAlignOptions = (select, edge, selected) => {
  if (!select) return;
  const labels = ALIGN_LABELS[edge] ?? ALIGN_LABELS.left;
  const currentValue = selected ?? select.value;
  select.innerHTML = '';
  ['start', 'center', 'end'].forEach((value) => {
    const option = createOption(value, labels[value] ?? value);
    if (value === currentValue) {
      option.selected = true;
    }
    select.appendChild(option);
  });
};

const createFieldLabel = (text) => {
  const label = document.createElement('label');
  label.className = 'form-label';
  const span = document.createElement('span');
  span.textContent = text;
  label.appendChild(span);
  return label;
};

const createHint = (text) => {
  const hint = document.createElement('p');
  hint.className = 'text-muted';
  hint.textContent = text;
  return hint;
};

const collectLocationRows = () =>
  Array.from(elements.locationsContainer?.querySelectorAll('.drilling-location-row') ?? []);

const readEntriesFromUI = () =>
  collectLocationRows().map((row) => {
    const edge = row.querySelector('[data-role="edge"]')?.value ?? 'left';
    const align = row.querySelector('[data-role="align"]')?.value ?? 'center';
    const axisOffset = toNumber(row.querySelector('[data-role="axis-offset"]')?.value, 0);
    const offset = toNumber(row.querySelector('[data-role="offset"]')?.value, 0);
    return normalizeEntry({ edge, align, axisOffset, offset });
  });

const onCustomEntriesChanged = (statusMessage = null) => {
  if (currentConfig.preset !== 'custom') {
    currentConfig = normalizeConfig({ ...currentConfig, preset: 'custom' });
  }
  const entries = readEntriesFromUI();
  currentConfig = normalizeConfig({ ...currentConfig, preset: 'custom', entries });
  setHiddenValue();
  getUpdate()();
  if (statusMessage) {
    getStatus()(statusMessage);
  }
};

const createLocationRow = (entry) => {
  const row = document.createElement('div');
  row.className = 'drilling-location-row';

  const edgeLabel = createFieldLabel('Edge');
  const edgeSelect = document.createElement('select');
  edgeSelect.className = 'form-select';
  edgeSelect.dataset.role = 'edge';
  EDGE_OPTIONS.forEach((opt) => {
    const option = createOption(opt.value, opt.label);
    if (opt.value === entry.edge) option.selected = true;
    edgeSelect.appendChild(option);
  });
  edgeLabel.appendChild(edgeSelect);
  row.appendChild(edgeLabel);

  const alignLabel = createFieldLabel('Alignment');
  const alignSelect = document.createElement('select');
  alignSelect.className = 'form-select';
  alignSelect.dataset.role = 'align';
  updateAlignOptions(alignSelect, entry.edge, entry.align);
  alignLabel.appendChild(alignSelect);
  row.appendChild(alignLabel);

  const axisWrapper = document.createElement('div');
  axisWrapper.className = 'layout-stack';
  axisWrapper.dataset.gap = 'snug';
  const axisLabel = createFieldLabel('Along-edge offset (in)');
  const axisInput = document.createElement('input');
  axisInput.type = 'number';
  axisInput.step = '0.01';
  axisInput.value = String(entry.axisOffset ?? 0);
  axisInput.className = 'form-control';
  axisInput.dataset.role = 'axis-offset';
  axisLabel.appendChild(axisInput);
  axisWrapper.appendChild(axisLabel);
  axisWrapper.appendChild(createHint('Measured from the selected alignment along the edge.'));
  row.appendChild(axisWrapper);

  const offsetWrapper = document.createElement('div');
  offsetWrapper.className = 'layout-stack';
  offsetWrapper.dataset.gap = 'snug';
  const offsetLabel = createFieldLabel('Edge offset (in)');
  const offsetInput = document.createElement('input');
  offsetInput.type = 'number';
  offsetInput.step = '0.01';
  offsetInput.min = '0';
  offsetInput.value = String(entry.offset ?? 0);
  offsetInput.className = 'form-control';
  offsetInput.dataset.role = 'offset';
  offsetLabel.appendChild(offsetInput);
  offsetWrapper.appendChild(offsetLabel);
  offsetWrapper.appendChild(createHint('Distance into the document from the chosen edge.'));
  row.appendChild(offsetWrapper);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'btn btn-ghost drilling-remove-location';
  removeButton.dataset.role = 'remove';
  removeButton.textContent = 'Remove';
  row.appendChild(removeButton);

  edgeSelect.addEventListener('change', () => {
    updateAlignOptions(alignSelect, edgeSelect.value, alignSelect.value);
    onCustomEntriesChanged('Updated hole edge');
  });
  alignSelect.addEventListener('change', () => onCustomEntriesChanged('Updated hole alignment'));
  axisInput.addEventListener('input', () => onCustomEntriesChanged());
  offsetInput.addEventListener('input', () => onCustomEntriesChanged());
  removeButton.addEventListener('click', () => {
    row.remove();
    onCustomEntriesChanged('Removed hole location');
  });

  return row;
};

const renderCustomEntries = () => {
  if (!elements.locationsContainer) return;
  elements.locationsContainer.innerHTML = '';
  currentConfig.entries.forEach((entry) => {
    const row = createLocationRow(entry);
    elements.locationsContainer.appendChild(row);
  });
};

const syncUIFromConfig = () => {
  if (elements.presetSelect) {
    elements.presetSelect.value = currentConfig.preset;
  }
  if (elements.sizeSelect) {
    elements.sizeSelect.value = String(currentConfig.size);
  }
  toggleCustomContainer(currentConfig.preset === 'custom');
  if (currentConfig.preset === 'custom') {
    if (currentConfig.entries.length === 0) {
      currentConfig = normalizeConfig({
        ...currentConfig,
        entries: PRESET_GENERATORS.custom(currentConfig.entries),
      });
      setHiddenValue();
    }
    renderCustomEntries();
  } else if (elements.locationsContainer) {
    elements.locationsContainer.innerHTML = '';
  }
};

const applyConfig = (config, { silent = false, statusMessage = null } = {}) => {
  let merged = normalizeConfig({ ...currentConfig, ...config });
  if (merged.preset === 'custom' && merged.entries.length === 0) {
    merged = normalizeConfig({ ...merged, entries: PRESET_GENERATORS.custom(merged.entries) });
  }
  currentConfig = merged;
  syncUIFromConfig();
  setHiddenValue();
  if (!silent) {
    getUpdate()();
    if (statusMessage) {
      getStatus()(statusMessage);
    }
  }
};

const handlePresetChange = () => {
  const preset = elements.presetSelect?.value ?? 'none';
  if (!VALID_PRESETS.has(preset)) return;
  const statusMessage =
    preset === 'custom'
      ? 'Custom hole drilling enabled'
      : preset === 'three-hole'
        ? '3-hole drilling preset applied'
        : 'Hole drilling disabled';
  const entries = preset === 'custom' ? currentConfig.entries : undefined;
  applyConfig({ preset, entries }, { statusMessage });
};

const handleSizeChange = () => {
  const raw = elements.sizeSelect?.value;
  const label = raw ? HOLE_SIZE_LABELS.get(raw) ?? `${Number(raw)} in` : null;
  applyConfig({ size: toNumber(raw, currentConfig.size) }, {
    statusMessage: label ? `Hole size set to ${label}` : 'Hole size updated',
  });
};

const handleAddLocation = () => {
  const base = currentConfig.entries[currentConfig.entries.length - 1] ?? DEFAULT_CUSTOM_ENTRY;
  const nextEntry = { ...base };
  applyConfig({ preset: 'custom', entries: [...currentConfig.entries, nextEntry] }, {
    statusMessage: 'Added hole location',
  });
};

const parseHiddenConfig = () => {
  if (!elements.hiddenInput) return null;
  const raw = elements.hiddenInput.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to parse saved drilling config', error);
  }
  return null;
};

const init = (context = {}) => {
  hydrateTabPanel(TAB_KEY);
  storedContext = { ...storedContext, ...context };
  if (initialized) {
    syncUIFromConfig();
    return;
  }

  elements = {
    presetSelect: $('#drillPreset'),
    sizeSelect: $('#drillSize'),
    customContainer: document.querySelector('[data-custom-config]'),
    locationsContainer: $('#drillLocations'),
    addButton: $('#drillAddLocation'),
    applyButton: $('#applyDrilling'),
    hiddenInput: $('#holePlanData'),
  };

  const saved = parseHiddenConfig();
  currentConfig = normalizeConfig(saved ?? currentConfig);
  syncUIFromConfig();
  setHiddenValue();

  elements.presetSelect?.addEventListener('change', handlePresetChange);
  elements.sizeSelect?.addEventListener('change', handleSizeChange);
  elements.addButton?.addEventListener('click', () => {
    handleAddLocation();
    if (elements.locationsContainer?.lastElementChild) {
      elements.locationsContainer.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
  elements.applyButton?.addEventListener('click', () => {
    setHiddenValue();
    getUpdate()();
    getStatus()('Hole plan applied to layout');
  });

  initialized = true;
};

const drillingTab = {
  key: TAB_KEY,
  init,
  onActivate(context) {
    init(context);
  },
  onRegister(context) {
    init(context);
  },
};

export default drillingTab;
