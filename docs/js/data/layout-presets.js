const perSide = (value) => ({ top: value, right: value, bottom: value, left: value });

export const layoutPresets = {
  'folded-business-card': {
    label: 'Folded Business Card',
    sheet: { width: 12, height: 18 },
    document: { width: 3.5, height: 5 },
    gutter: { horizontal: 0.125, vertical: 0.125 },
    nonPrintable: perSide(0.0625),
    scores: { horizontal: [0.5], vertical: [] },
    perforations: { horizontal: [], vertical: [] },
  },
  'trifold-brochure': {
    label: 'Tri-fold Brochure',
    sheet: { width: 12, height: 18 },
    document: { width: 11, height: 8.5 },
    gutter: { horizontal: 0.25, vertical: 0.25 },
    nonPrintable: perSide(0.125),
    scores: { horizontal: [], vertical: [1 / 3, 2 / 3] },
    perforations: { horizontal: [], vertical: [] },
  },
  'postcard-gang-run': {
    label: 'Postcard Gang Run',
    sheet: { width: 13, height: 19 },
    document: { width: 4, height: 6 },
    gutter: { horizontal: 0.125, vertical: 0.125 },
    nonPrintable: perSide(0.1),
    scores: { horizontal: [], vertical: [] },
    perforations: { horizontal: [], vertical: [] },
  },
  'event-tickets': {
    label: 'Event Tickets',
    sheet: { width: 12, height: 18 },
    document: { width: 2, height: 5.5 },
    gutter: { horizontal: 0.125, vertical: 0.25 },
    nonPrintable: perSide(0.0625),
    scores: { horizontal: [], vertical: [0.5] },
    perforations: { horizontal: [], vertical: [0.5] },
  },
  'table-tents': {
    label: 'Table Tents',
    sheet: { width: 13, height: 19 },
    document: { width: 5, height: 7 },
    gutter: { horizontal: 0.25, vertical: 0.25 },
    nonPrintable: perSide(0.125),
    scores: { horizontal: [0.33, 0.66], vertical: [] },
    perforations: { horizontal: [], vertical: [] },
  },
};

export default layoutPresets;
