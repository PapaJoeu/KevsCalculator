import { describe, it, expect } from 'vitest';
import { toFiniteNumber, sanitizeInteger, sanitizeFloat } from '../docs/js/utils/numbers.js';

describe('toFiniteNumber', () => {
  it('converts numeric strings', () => {
    expect(toFiniteNumber('42')).toBe(42);
    expect(toFiniteNumber('3.14')).toBe(3.14);
  });

  it('passes through finite numbers', () => {
    expect(toFiniteNumber(7)).toBe(7);
    expect(toFiniteNumber(-3.5)).toBe(-3.5);
    expect(toFiniteNumber(0)).toBe(0);
  });

  it('returns fallback for non-finite values', () => {
    expect(toFiniteNumber(NaN)).toBe(0);
    expect(toFiniteNumber(Infinity)).toBe(0);
    expect(toFiniteNumber(-Infinity)).toBe(0);
    expect(toFiniteNumber(undefined)).toBe(0);
    expect(toFiniteNumber(null)).toBe(0);
    expect(toFiniteNumber('abc')).toBe(0);
    expect(toFiniteNumber('')).toBe(0);
  });

  it('uses custom fallback', () => {
    expect(toFiniteNumber('abc', 99)).toBe(99);
    expect(toFiniteNumber(NaN, -1)).toBe(-1);
  });
});

describe('sanitizeInteger', () => {
  it('floors and clamps to min', () => {
    expect(sanitizeInteger(3.7)).toBe(3);
    expect(sanitizeInteger(-5)).toBe(0);
    expect(sanitizeInteger(0)).toBe(0);
  });

  it('handles string input', () => {
    expect(sanitizeInteger('10')).toBe(10);
    expect(sanitizeInteger('2.9')).toBe(2);
  });

  it('returns min for non-numeric input', () => {
    expect(sanitizeInteger('abc')).toBe(0);
    expect(sanitizeInteger(null)).toBe(0);
    expect(sanitizeInteger(undefined)).toBe(0);
  });

  it('supports custom min', () => {
    expect(sanitizeInteger(-5, -10)).toBe(-5);
    expect(sanitizeInteger(3, 5)).toBe(5);
  });
});

describe('sanitizeFloat', () => {
  it('clamps to min without flooring', () => {
    expect(sanitizeFloat(3.7)).toBe(3.7);
    expect(sanitizeFloat(-5)).toBe(0);
    expect(sanitizeFloat(0)).toBe(0);
  });

  it('handles string input', () => {
    expect(sanitizeFloat('2.5')).toBe(2.5);
  });

  it('returns min for non-numeric input', () => {
    expect(sanitizeFloat('abc')).toBe(0);
    expect(sanitizeFloat(null)).toBe(0);
  });

  it('supports custom min', () => {
    expect(sanitizeFloat(1.5, 2.0)).toBe(2.0);
  });
});
