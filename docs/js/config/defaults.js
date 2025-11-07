const SYSTEM_DEFAULT_INPUTS = {
  imperial: {
    sheet: {
      width: 12,
      height: 18,
    },
    document: {
      width: 3.5,
      height: 2,
    },
    gutter: {
      horizontal: 0.125,
      vertical: 0.125,
    },
    nonPrintable: {
      top: 0.0625,
      right: 0.0625,
      bottom: 0.0625,
      left: 0.0625,
    },
  },
  metric: {
    sheet: {
      width: 11.69291, // 297 mm
      height: 16.53543, // 420 mm
    },
    document: {
      width: 3.34646, // 85 mm
      height: 2.16535, // 55 mm
    },
    gutter: {
      horizontal: 0.11811, // 3 mm
      vertical: 0.11811, // 3 mm
    },
    nonPrintable: {
      top: 0.11811, // 3 mm
      right: 0.11811, // 3 mm
      bottom: 0.11811, // 3 mm
      left: 0.11811, // 3 mm
    },
  },
};

function cloneSystemDefaults(units, defaults) {
  return {
    units,
    sheet: { ...defaults.sheet },
    document: { ...defaults.document },
    gutter: { ...defaults.gutter },
    nonPrintable: { ...defaults.nonPrintable },
  };
}

export function getDefaultInputsForUnits(units = 'in') {
  const system = units === 'mm' ? 'metric' : 'imperial';
  const normalizedUnits = system === 'metric' ? 'mm' : 'in';
  const defaults = SYSTEM_DEFAULT_INPUTS[system];
  return cloneSystemDefaults(normalizedUnits, defaults);
}

export const DEFAULT_INPUTS = getDefaultInputsForUnits('in');

export { SYSTEM_DEFAULT_INPUTS };
