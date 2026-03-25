'use client';

/**
 * 🔢 Safe Decimal Formatting for React Components
 * 
 * Prevents "Objects are not valid as a React child" errors by safely converting
 * Decimal.js objects to strings before rendering in React components
 */

import Decimal from 'decimal.js';

/**
 * Safely convert Decimal to number for calculations
 */
export const safeDecimalToNumber = (value: Decimal | number | string | undefined | null): number => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (value instanceof Decimal) return value.toNumber();
  return 0;
};

/**
 * Safely convert Decimal to string for display
 */
export const safeDecimalToString = (value: Decimal | number | string | undefined | null, decimals: number = 2): string => {
  if (value === undefined || value === null) return '0';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toFixed(decimals);
  if (value instanceof Decimal) return value.toFixed(decimals);
  return '0';
};

/**
 * Format Decimal as currency with proper formatting
 */
export const formatDecimalCurrency = (value: Decimal | number | string | undefined | null, symbol: string = '$', _decimals: number = 2): string => {
  const num = safeDecimalToNumber(value);
  
  if (num === 0) return `${symbol}0`;
  if (num < 0.000001) return `${symbol}< 0.000001`;
  if (num < 0.01) return `${symbol}${num.toFixed(6)}`;
  if (num < 1) return `${symbol}${num.toFixed(4)}`;
  if (num < 1000) return `${symbol}${num.toFixed(2)}`;
  if (num < 1000000) return `${symbol}${(num / 1000).toFixed(1)}K`;
  if (num < 1000000000) return `${symbol}${(num / 1000000).toFixed(1)}M`;
  return `${symbol}${(num / 1000000000).toFixed(1)}B`;
};

/**
 * Format Decimal as percentage
 */
export const formatDecimalPercentage = (value: Decimal | number | string | undefined | null, decimals: number = 2): string => {
  const num = safeDecimalToNumber(value);
  return `${num.toFixed(decimals)}%`;
};

/**
 * Format Decimal as token amount
 */
export const formatDecimalTokenAmount = (value: Decimal | number | string | undefined | null, decimals: number = 18): string => {
  const num = safeDecimalToNumber(value);
  
  if (num === 0) return '0';
  if (num < 0.000001) return '< 0.000001';
  if (num < 0.01) return num.toFixed(6);
  if (num < 1) return num.toFixed(4);
  if (num < 1000) return num.toFixed(2);
  
  if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
  if (num < 1000000000) return `${(num / 1000000).toFixed(1)}M`;
  return `${(num / 1000000000).toFixed(1)}B`;
};

/**
 * Safe division of Decimal objects
 */
export const safeDecimalDivide = (numerator: Decimal | number | string | undefined | null, denominator: Decimal | number | string | undefined | null): number => {
  const num = safeDecimalToNumber(numerator);
  const den = safeDecimalToNumber(denominator);
  
  if (den === 0) return 0;
  return num / den;
};

/**
 * Safe multiplication of Decimal objects
 */
export const safeDecimalMultiply = (value: Decimal | number | string | undefined | null, multiplier: number): number => {
  const num = safeDecimalToNumber(value);
  return num * multiplier;
};

/**
 * Safe addition of Decimal objects
 */
export const safeDecimalAdd = (a: Decimal | number | string | undefined | null, b: Decimal | number | string | undefined | null): number => {
  const numA = safeDecimalToNumber(a);
  const numB = safeDecimalToNumber(b);
  return numA + numB;
};

/**
 * Safe subtraction of Decimal objects
 */
export const safeDecimalSubtract = (a: Decimal | number | string | undefined | null, b: Decimal | number | string | undefined | null): number => {
  const numA = safeDecimalToNumber(a);
  const numB = safeDecimalToNumber(b);
  return numA - numB;
};

/**
 * Check if Decimal value is greater than another
 */
export const safeDecimalGreaterThan = (a: Decimal | number | string | undefined | null, b: Decimal | number | string | undefined | null): boolean => {
  const numA = safeDecimalToNumber(a);
  const numB = safeDecimalToNumber(b);
  return numA > numB;
};

/**
 * Check if Decimal value is greater than zero
 */
export const safeDecimalGreaterThanZero = (value: Decimal | number | string | undefined | null): boolean => {
  return safeDecimalGreaterThan(value, 0);
};

/**
 * Check if Decimal value is greater than or equal to another
 */
export const safeDecimalGreaterThanOrEqual = (a: Decimal | number | string | undefined | null, b: Decimal | number | string | undefined | null): boolean => {
  const numA = safeDecimalToNumber(a);
  const numB = safeDecimalToNumber(b);
  return numA >= numB;
};

/**
 * Get the maximum value from an array of Decimal objects
 */
export const safeDecimalMax = (values: (Decimal | number | string | undefined | null)[]): number => {
  const numbers = values.map(safeDecimalToNumber);
  return Math.max(...numbers);
};

/**
 * Get the minimum value from an array of Decimal objects
 */
export const safeDecimalMin = (values: (Decimal | number | string | undefined | null)[]): number => {
  const numbers = values.map(safeDecimalToNumber);
  return Math.min(...numbers);
};

/**
 * Sum an array of Decimal objects
 */
export const safeDecimalSum = (values: (Decimal | number | string | undefined | null)[]): number => {
  return values.reduce((sum: number, value) => sum + safeDecimalToNumber(value), 0);
};

/**
 * Average of an array of Decimal objects
 */
export const safeDecimalAverage = (values: (Decimal | number | string | undefined | null)[]): number => {
  if (values.length === 0) return 0;
  return safeDecimalSum(values) / values.length;
};
