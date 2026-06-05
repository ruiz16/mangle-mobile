// =============================================================================
// Mangle — Currency helpers
// =============================================================================

/**
 * Format a number as Colombian Pesos.
 * Example: 100000 → "$100.000"
 */
export function formatCOP(value: number): string {
  return '$' + value.toLocaleString('es-CO', { minimumFractionDigits: 0 });
}
