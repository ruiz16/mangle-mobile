// =============================================================================
// Mangle — Currency helpers
// =============================================================================

import { formatUnits } from 'viem';

/**
 * Default COP/cUSD exchange rate.
 * Can be overridden via VITE_COP_USD_RATE env var.
 */
export function getExchangeRate(): number {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_COP_USD_RATE) {
    const rate = Number(import.meta.env.VITE_COP_USD_RATE);
    if (!Number.isNaN(rate) && rate > 0) return rate;
  }
  return 3633.45; // default fallback
}

/**
 * Convert COPm to cUSD (2 decimal precision).
 * Example: copmToCusd(1_000_000) → 275.23 (at rate 3633.45)
 */
export function copmToCusd(copm: number, rate?: number): number {
  const r = rate ?? getExchangeRate();
  return Math.round((copm / r) * 100) / 100;
}

/**
 * Format cUSD amount for display.
 * Example: formatCusd(275.23) → "$275.23 cUSD"
 */
export function formatCusd(value: number): string {
  return '$' + value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' cUSD';
}

/**
 * Format a COPm raw bigint balance as a human-readable COP string.
 * COPm has 18 decimals. Example: 12500000000000000000n → "$12.50"
 */
export function formatCopmBalance(balance: bigint): string {
  const formatted = formatUnits(balance, 18);
  const num = parseFloat(formatted);
  return '$' + num.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format a number as Colombian Pesos (for loan amounts).
 * Example: 100000 → "$100.000"
 */
export function formatCOP(value: number): string {
  return '$' + value.toLocaleString('es-CO', { minimumFractionDigits: 0 });
}
