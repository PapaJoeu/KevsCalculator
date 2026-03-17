/**
 * Consolidated number sanitization utilities.
 *
 * Every module that needs to coerce arbitrary values into safe, finite numbers
 * should import from here instead of rolling its own conversion.
 */

/**
 * Converts any value to a finite number, returning `fallback` when the result
 * is not finite (NaN, Infinity, or non-numeric input).
 */
export const toFiniteNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Coerces a value to a non-negative integer. Useful for counts, quantities,
 * and other discrete values that must never be fractional or negative.
 */
export const sanitizeInteger = (value, min = 0) =>
  Math.max(min, Math.floor(Number(value) || 0));

/**
 * Coerces a value to a non-negative float. Useful for percentages and other
 * continuous values that must never be negative.
 */
export const sanitizeFloat = (value, min = 0) =>
  Math.max(min, Number(value) || 0);
