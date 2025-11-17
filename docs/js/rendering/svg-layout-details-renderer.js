import { inchesToMillimeters, getUnitsPrecision } from '../utils/units.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PRINT_DPI = 96;
const MILLIMETER_PRECISION = getUnitsPrecision('mm');

const INLINE_STYLE_MARKER = 'data-layout-details-style';

const LAYOUT_DETAILS_STYLES = `
  .layout-details-canvas { fill: #ffffff; }
  .layout-details-title {
    font-family: "Inter", "Segoe UI", sans-serif;
    font-size: 18px;
    font-weight: 600;
    fill: #0f172a;
  }
  .layout-details-table-border {
    fill: #f8fafc;
    stroke: #cbd5f5;
    stroke-width: 1px;
  }
  .layout-details-table-header {
    fill: #e2e8f0;
  }
  .layout-details-table-header-text {
    font-family: "Inter", "Segoe UI", sans-serif;
    font-size: 12px;
    font-weight: 600;
    fill: #0f172a;
  }
  .layout-details-table-row {
    fill: #ffffff;
  }
  .layout-details-table-row-alt {
    fill: #f8fafc;
  }
  .layout-details-table-text {
    font-family: "Inter", "Segoe UI", sans-serif;
    font-size: 12px;
    font-weight: 500;
    fill: #0f172a;
  }
  .layout-details-table-text--numeric {
    text-anchor: end;
  }
  .layout-details-grid-line {
    stroke: #cbd5f5;
    stroke-width: 1px;
  }
`;

const TITLE_FONT_SIZE = 18;
const TITLE_MARGIN = 10;
const TABLE_HEADER_HEIGHT = 32;
const TABLE_ROW_HEIGHT = 28;
const TABLE_BOTTOM_MARGIN = 24;
const CELL_PADDING = 12;
const COLUMN_GAP = 24;
const PAGE_PADDING_INCHES = 0.5;

const toFiniteNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function ensureInlineStyles(svg) {
  if (!svg) return;
  if (svg.querySelector(`style[${INLINE_STYLE_MARKER}="true"]`)) return;
  const styleEl = document.createElementNS(SVG_NS, 'style');
  styleEl.setAttribute('type', 'text/css');
  styleEl.setAttribute(INLINE_STYLE_MARKER, 'true');
  styleEl.textContent = LAYOUT_DETAILS_STYLES.trim();
  svg.insertBefore(styleEl, svg.firstChild);
}

function createSvgElement(tag) {
  return document.createElementNS(SVG_NS, tag);
}

function createSvgRoot(widthInches, heightInches) {
  const svg = createSvgElement('svg');
  const widthPx = widthInches * PRINT_DPI;
  const heightPx = heightInches * PRINT_DPI;

  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `0 0 ${widthPx} ${heightPx}`);
  svg.setAttribute('width', `${widthInches}in`);
  svg.setAttribute('height', `${heightInches}in`);
  svg.setAttribute('aria-label', 'Layout details summary');

  return { svg, scale: PRINT_DPI, widthPx, heightPx };
}

function formatDistanceInches(value, digits = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)} in`;
}

function formatDistanceMillimeters(value, digits = MILLIMETER_PRECISION) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)} mm`;
}

function formatMeasurementPair(inches) {
  const n = Number(inches);
  if (!Number.isFinite(n)) return '—';
  const mm = inchesToMillimeters(n, MILLIMETER_PRECISION);
  return `${n.toFixed(3)} in (${mm.toFixed(MILLIMETER_PRECISION)} mm)`;
}

function formatPerSide(perSide = {}) {
  const top = formatMeasurementPair(perSide.top);
  const right = formatMeasurementPair(perSide.right);
  const bottom = formatMeasurementPair(perSide.bottom);
  const left = formatMeasurementPair(perSide.left);
  return `T ${top}  |  R ${right}  |  B ${bottom}  |  L ${left}`;
}

function ensureRows(rows, columns) {
  if (Array.isArray(rows) && rows.length > 0) {
    return rows.map((row) => ({ ...row }));
  }
  const placeholder = {};
  columns.forEach((col, index) => {
    placeholder[col.key] = index === 0 ? 'None' : '—';
  });
  return [placeholder];
}

function drawTable(svg, xPx, yPx, widthPx, config) {
  const group = createSvgElement('g');
  group.setAttribute('transform', `translate(${xPx}, ${yPx})`);
  svg.appendChild(group);

  const title = createSvgElement('text');
  title.textContent = config.title;
  title.classList.add('layout-details-title');
  title.setAttribute('x', 0);
  title.setAttribute('y', TITLE_FONT_SIZE);
  group.appendChild(title);

  const tableGroup = createSvgElement('g');
  tableGroup.setAttribute('transform', `translate(0, ${TITLE_FONT_SIZE + TITLE_MARGIN})`);
  group.appendChild(tableGroup);

  const columns = Array.isArray(config.columns) ? config.columns : [];
  const columnWeights = columns.map((col) => {
    const weight = Number(col.weight);
    return Number.isFinite(weight) && weight > 0 ? weight : 1;
  });
  const totalWeight = columnWeights.reduce((sum, weight) => sum + weight, 0) || 1;
  const columnWidths = columnWeights.map((weight) => (weight / totalWeight) * widthPx);
  const columnOffsets = columnWidths.map((_, index) =>
    columnWidths.slice(0, index).reduce((sum, value) => sum + value, 0),
  );

  const rows = ensureRows(config.rows, columns);
  const headerHeight = TABLE_HEADER_HEIGHT;
  const bodyHeight = rows.length * TABLE_ROW_HEIGHT;
  const tableHeight = headerHeight + bodyHeight;

  const borderRect = createSvgElement('rect');
  borderRect.setAttribute('x', 0);
  borderRect.setAttribute('y', 0);
  borderRect.setAttribute('width', widthPx);
  borderRect.setAttribute('height', tableHeight);
  borderRect.classList.add('layout-details-table-border');
  tableGroup.appendChild(borderRect);

  const headerRect = createSvgElement('rect');
  headerRect.setAttribute('x', 0);
  headerRect.setAttribute('y', 0);
  headerRect.setAttribute('width', widthPx);
  headerRect.setAttribute('height', headerHeight);
  headerRect.classList.add('layout-details-table-header');
  tableGroup.appendChild(headerRect);

  // Draw row backgrounds for zebra striping.
  rows.forEach((row, index) => {
    const rowRect = createSvgElement('rect');
    rowRect.setAttribute('x', 0);
    rowRect.setAttribute('y', headerHeight + index * TABLE_ROW_HEIGHT);
    rowRect.setAttribute('width', widthPx);
    rowRect.setAttribute('height', TABLE_ROW_HEIGHT);
    rowRect.classList.add('layout-details-table-row');
    if (index % 2 === 1) {
      rowRect.classList.add('layout-details-table-row-alt');
    }
    tableGroup.appendChild(rowRect);
  });

  // Grid lines (vertical).
  for (let i = 1; i < columns.length; i += 1) {
    const line = createSvgElement('line');
    line.setAttribute('x1', columnOffsets[i]);
    line.setAttribute('x2', columnOffsets[i]);
    line.setAttribute('y1', 0);
    line.setAttribute('y2', tableHeight);
    line.classList.add('layout-details-grid-line');
    tableGroup.appendChild(line);
  }

  // Grid line separating the header from the body.
  const headerLine = createSvgElement('line');
  headerLine.setAttribute('x1', 0);
  headerLine.setAttribute('x2', widthPx);
  headerLine.setAttribute('y1', headerHeight);
  headerLine.setAttribute('y2', headerHeight);
  headerLine.classList.add('layout-details-grid-line');
  tableGroup.appendChild(headerLine);

  // Grid lines (horizontal) for each row boundary.
  for (let i = 1; i <= rows.length; i += 1) {
    const y = headerHeight + i * TABLE_ROW_HEIGHT;
    const line = createSvgElement('line');
    line.setAttribute('x1', 0);
    line.setAttribute('x2', widthPx);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    line.classList.add('layout-details-grid-line');
    tableGroup.appendChild(line);
  }

  const headerBaseline = headerHeight / 2;
  columns.forEach((col, index) => {
    const headerText = createSvgElement('text');
    headerText.textContent = col.label ?? '';
    headerText.classList.add('layout-details-table-header-text');
    headerText.setAttribute('dominant-baseline', 'middle');
    headerText.setAttribute('y', headerBaseline);
    const isRight = col.align === 'right';
    headerText.setAttribute('text-anchor', isRight ? 'end' : 'start');
    const x = isRight
      ? columnOffsets[index] + columnWidths[index] - CELL_PADDING
      : columnOffsets[index] + CELL_PADDING;
    headerText.setAttribute('x', x);
    tableGroup.appendChild(headerText);
  });

  rows.forEach((row, rowIndex) => {
    const rowBaseline = headerHeight + rowIndex * TABLE_ROW_HEIGHT + TABLE_ROW_HEIGHT / 2;
    columns.forEach((col, colIndex) => {
      const text = createSvgElement('text');
      const value = row[col.key];
      text.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
      text.classList.add('layout-details-table-text');
      const isRight = col.align === 'right';
      if (isRight) {
        text.classList.add('layout-details-table-text--numeric');
      }
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('text-anchor', isRight ? 'end' : 'start');
      const x = isRight
        ? columnOffsets[colIndex] + columnWidths[colIndex] - CELL_PADDING
        : columnOffsets[colIndex] + CELL_PADDING;
      text.setAttribute('x', x);
      text.setAttribute('y', rowBaseline);
      tableGroup.appendChild(text);
    });
  });

  const totalHeight = TITLE_FONT_SIZE + TITLE_MARGIN + tableHeight + TABLE_BOTTOM_MARGIN;
  return totalHeight;
}

function createInputsTable(layout, context) {
  if (!layout) return null;
  const sheet = layout.sheet ?? {};
  const document = layout.document ?? {};
  const layoutArea = layout.layoutArea ?? {};
  const counts = layout.counts ?? {};
  const usage = layout.usage ?? {};
  const realizedMargins = layout.realizedMargins ?? {};
  const nonPrintable = context?.sheet?.nonPrintable ?? layout.sheet?.nonPrintable ?? {};
  const gutters = layout.gutter ?? {};

  const rows = [
    { label: 'Sheet Width', value: formatMeasurementPair(sheet.rawWidth) },
    { label: 'Sheet Height', value: formatMeasurementPair(sheet.rawHeight) },
    { label: 'Document Width', value: formatMeasurementPair(document.width) },
    { label: 'Document Height', value: formatMeasurementPair(document.height) },
    {
      label: 'Documents',
      value: `${counts.across ?? 0} across × ${counts.down ?? 0} down (total ${(counts.across ?? 0) * (counts.down ?? 0)})`,
    },
    { label: 'Gutter Horizontal', value: formatMeasurementPair(gutters.horizontal) },
    { label: 'Gutter Vertical', value: formatMeasurementPair(gutters.vertical) },
    { label: 'Layout Origin X', value: formatMeasurementPair(layoutArea.originX) },
    { label: 'Layout Origin Y', value: formatMeasurementPair(layoutArea.originY) },
    { label: 'Layout Width', value: formatMeasurementPair(layoutArea.width) },
    { label: 'Layout Height', value: formatMeasurementPair(layoutArea.height) },
    {
      label: 'Used Span',
      value: `H ${formatMeasurementPair(usage.horizontal?.usedSpan)}  |  V ${formatMeasurementPair(usage.vertical?.usedSpan)}`,
    },
    {
      label: 'Trailing Margin',
      value: `H ${formatMeasurementPair(usage.horizontal?.trailingMargin)}  |  V ${formatMeasurementPair(usage.vertical?.trailingMargin)}`,
    },
    { label: 'Realized Margins', value: formatPerSide(realizedMargins) },
    { label: 'Non-Printable Margins', value: formatPerSide(nonPrintable) },
  ];

  return {
    title: 'Inputs',
    columns: [
      { key: 'label', label: 'Field', align: 'left', weight: 1.2 },
      { key: 'value', label: 'Value', align: 'left', weight: 2 },
    ],
    rows,
  };
}

function createMeasurementTable(title, items = []) {
  const rows = Array.isArray(items) && items.length > 0
    ? items.map((item) => ({
        label: item.label ?? '—',
        inches: formatDistanceInches(item.inches),
        millimeters: formatDistanceMillimeters(item.millimeters),
      }))
    : [];

  return {
    title,
    columns: [
      { key: 'label', label: 'Label', align: 'left' },
      { key: 'inches', label: 'Inches', align: 'right' },
      { key: 'millimeters', label: 'Millimeters', align: 'right' },
    ],
    rows,
  };
}

function createDirectionalMeasurementTable(title, horizontal = [], vertical = []) {
  const rows = [];
  if (Array.isArray(horizontal)) {
    horizontal.forEach((item) => {
      rows.push({
        direction: 'Horizontal',
        label: item.label ?? '—',
        inches: formatDistanceInches(item.inches),
        millimeters: formatDistanceMillimeters(item.millimeters),
      });
    });
  }
  if (Array.isArray(vertical)) {
    vertical.forEach((item) => {
      rows.push({
        direction: 'Vertical',
        label: item.label ?? '—',
        inches: formatDistanceInches(item.inches),
        millimeters: formatDistanceMillimeters(item.millimeters),
      });
    });
  }

  return {
    title,
    columns: [
      { key: 'direction', label: 'Direction', align: 'left' },
      { key: 'label', label: 'Label', align: 'left' },
      { key: 'inches', label: 'Inches', align: 'right' },
      { key: 'millimeters', label: 'Millimeters', align: 'right' },
    ],
    rows,
  };
}

function createProgramSequenceTable(programSequence = []) {
  const rows = Array.isArray(programSequence)
    ? programSequence.map((step) => ({
        label: step.label ?? 'Step',
        inches: formatDistanceInches(step.inches),
        millimeters: formatDistanceMillimeters(step.millimeters),
      }))
    : [];

  return {
    title: 'Program Sequence',
    columns: [
      { key: 'label', label: 'Step', align: 'left' },
      { key: 'inches', label: 'Inches', align: 'right' },
      { key: 'millimeters', label: 'Millimeters', align: 'right' },
    ],
    rows,
  };
}

function createHoleTable(holes = []) {
  const rows = Array.isArray(holes)
    ? holes.map((hole) => {
        const x = formatMeasurementPair(hole.x);
        const y = formatMeasurementPair(hole.y);
        const diameter = formatMeasurementPair(hole.diameter);
        const docLabel = hole.docAcross && hole.docDown ? `${hole.docAcross}, ${hole.docDown}` : '—';
        return {
          label: hole.label ?? 'Hole',
          document: docLabel,
          x,
          y,
          diameter,
        };
      })
    : [];

  return {
    title: 'Hole Drilling',
    columns: [
      { key: 'label', label: 'Hole', align: 'left' },
      { key: 'document', label: 'Doc (Across,Down)', align: 'left' },
      { key: 'x', label: 'X Position', align: 'left' },
      { key: 'y', label: 'Y Position', align: 'left' },
      { key: 'diameter', label: 'Diameter', align: 'left' },
    ],
    rows,
  };
}

export function createLayoutDetailsSvg({ layout, finishing, context, programSequence }) {
  if (!layout?.sheet) return null;
  const width = toFiniteNumber(layout.sheet.rawWidth);
  const height = toFiniteNumber(layout.sheet.rawHeight);
  if (width === null || height === null || width <= 0 || height <= 0) return null;

  const { svg, scale, widthPx, heightPx } = createSvgRoot(width, height);
  ensureInlineStyles(svg);

  const background = createSvgElement('rect');
  background.setAttribute('x', 0);
  background.setAttribute('y', 0);
  background.setAttribute('width', widthPx);
  background.setAttribute('height', heightPx);
  background.classList.add('layout-details-canvas');
  svg.appendChild(background);

  const paddingPx = PAGE_PADDING_INCHES * scale;
  const contentWidthPx = Math.max(widthPx - paddingPx * 2, 0);
  const columnCount = contentWidthPx > 720 ? 2 : 1;
  const columnWidthPx = columnCount > 1
    ? (contentWidthPx - COLUMN_GAP * (columnCount - 1)) / columnCount
    : contentWidthPx;

  const tables = [
    createInputsTable(layout, context),
    createProgramSequenceTable(programSequence),
    createMeasurementTable('Cuts', finishing?.cuts),
    createMeasurementTable('Slits', finishing?.slits),
    createDirectionalMeasurementTable('Scores', finishing?.scores?.horizontal, finishing?.scores?.vertical),
    createDirectionalMeasurementTable('Perforations', finishing?.perforations?.horizontal, finishing?.perforations?.vertical),
    createHoleTable(finishing?.holes),
  ].filter(Boolean);

  const columnHeights = new Array(columnCount).fill(paddingPx);
  tables.forEach((table) => {
    const targetColumn = columnCount > 1
      ? columnHeights.indexOf(Math.min(...columnHeights))
      : 0;
    const x = paddingPx + targetColumn * (columnWidthPx + COLUMN_GAP);
    const y = columnHeights[targetColumn];
    const usedHeight = drawTable(svg, x, y, columnWidthPx, table);
    columnHeights[targetColumn] = y + usedHeight;
  });

  return svg;
}

export default createLayoutDetailsSvg;
