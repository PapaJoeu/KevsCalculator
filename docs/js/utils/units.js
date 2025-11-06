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
