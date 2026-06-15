// =============================================================================
// Cuotas — server-state vía TanStack Query
// =============================================================================

import { useApiQuery } from './useApiQuery';
import { queryKeys } from './client';
import type { ApiCuota, PagoConfig } from '../types';

/** GET /api/mis-cuotas — todas las cuotas del prestatario (todos sus créditos). */
export function useCuotas() {
  return useApiQuery<{ cuotas: ApiCuota[] }>(queryKeys.cuotas, '/api/mis-cuotas');
}

/** GET /api/mobile/pago-config — configuración de pago (no requiere auth). */
export function usePagoConfig() {
  return useApiQuery<PagoConfig>(['pago-config'], '/api/mobile/pago-config', {
    staleTime: 5 * 60_000,
  });
}

/** Cuenta cuántas cuotas de un crédito están pagadas. */
export function cuotasPagadas(cuotas: ApiCuota[], creditoId: string): number {
  return cuotas.filter((c) => c.credito_id === creditoId && c.estado === 'pagada').length;
}
