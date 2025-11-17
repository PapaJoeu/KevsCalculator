export const MM_PER_INCH = 25.4;
export const DISPLAY_MILLIMETERS_PRECISION = 2;

const roundToPrecision = (value, precision) => {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(precision)) return value;
  return Number(value.toFixed(precision));
};

export const clampToZero = (value) => Math.max(0, value);

export const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const trimTrailingZeros = (str) => {
  if (typeof str !== 'string' || !str.includes('.')) return str;
  const stripped = str.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
  return stripped === '' ? '0' : stripped;
};

export const getUnitsPrecision = (units) => (units === 'mm' ? 2 : 3);

export const inchesToMillimeters = (inches, precision = 3) =>
  roundToPrecision(inches * MM_PER_INCH, precision);

export const formatUnitsValue = (value, units, precisionOverride) => {
  if (value == null || value === '') return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  const precision = Number.isFinite(precisionOverride) ? precisionOverride : getUnitsPrecision(units);
  return trimTrailingZeros(numeric.toFixed(precision));
};

export const formatInchesForUnits = (valueInInches, units, precisionOverride) => {
  if (!Number.isFinite(valueInInches)) return '';
  const converted = units === 'mm' ? valueInInches * MM_PER_INCH : valueInInches;
  return formatUnitsValue(converted, units, precisionOverride);
};

export const convertForUnits = (value, units) => formatInchesForUnits(value, units);

export const describePresetValue = (value, units) => formatInchesForUnits(value, units);

export const formatValueForUnits = (value, units) => {
  if (value == null) return '';
  if (units === 'mm') return formatUnitsValue(value * MM_PER_INCH, 'mm', 2);
  if (!Number.isFinite(value)) return '';
  return Number(value.toFixed(4)).toString();
};

export const getUnitsLabel = (units) => (units === 'mm' ? 'mm' : 'in');

export const formatMeasurementValue = (value, units, precision) => {
  if (!Number.isFinite(value)) return '';
  const decimals = Number.isFinite(precision) ? precision : getUnitsPrecision(units);
  const converted = units === 'mm' ? value * MM_PER_INCH : value;
  return converted.toFixed(decimals);
};

export const formatMeasurement = (value, units, precision) => {
  const formatted = formatMeasurementValue(value, units, precision);
  if (formatted === '') return '';
  return `${formatted} ${getUnitsLabel(units)}`;
};
