// =============================================================================
// Mangle — Currency helpers
// =============================================================================

import { formatUnits } from 'viem';

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
