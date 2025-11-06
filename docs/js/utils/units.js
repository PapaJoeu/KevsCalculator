export const MM_PER_INCH = 25.4;

export const clampToZero = (value) => Math.max(0, value);

export const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const inchesToMillimeters = (inches, precision = 3) =>
  Number((inches * MM_PER_INCH).toFixed(precision));

export const convertForUnits = (value, units) =>
  units === 'mm' ? (value * MM_PER_INCH).toFixed(2) : value;

export const describePresetValue = (value, units) =>
  units === 'mm' ? (value * MM_PER_INCH).toFixed(2) : value.toString();

export const formatValueForUnits = (value, units) => {
  if (value == null) return '';
  if (units === 'mm') return (value * MM_PER_INCH).toFixed(2);
  if (!Number.isFinite(value)) return '';
  return Number(value.toFixed(4)).toString();
};

export const getUnitsLabel = (units) => (units === 'mm' ? 'mm' : 'in');

export const formatMeasurementValue = (value, units, precision) => {
  if (!Number.isFinite(value)) return '';
  const decimals = Number.isFinite(precision) ? precision : units === 'mm' ? 2 : 3;
  const converted = units === 'mm' ? value * MM_PER_INCH : value;
  return converted.toFixed(decimals);
};

export const formatMeasurement = (value, units, precision) => {
  const formatted = formatMeasurementValue(value, units, precision);
  if (formatted === '') return '';
  return `${formatted} ${getUnitsLabel(units)}`;
};
