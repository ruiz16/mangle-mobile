// =============================================================================
// Créditos — server-state vía TanStack Query (ÚNICA fuente de verdad)
// =============================================================================
//
// Reemplaza los campos locales creditEstado/moneda/installmentsPaid y las
// acciones submitLoan/approveLoan/payInstallment del antiguo AppState.
// =============================================================================

import { apiPost } from '../lib/api';
import { useApiQuery, useApiMutation } from './useApiQuery';
import { queryKeys } from './client';
import type { CreditEstado } from '../types';

// Estado del crédito tal como lo expone el backend (más granular que la UI).
export type BackendEstadoCredito =
  | 'pendiente' | 'avalado' | 'aprobado' | 'desembolsado'
  | 'pagado' | 'default' | 'expirado';

const ESTADOS_EN_REVISION: BackendEstadoCredito[] = ['pendiente', 'avalado', 'aprobado'];

/** Mapea el estado del backend al estado simplificado que ve el usuario. */
export function mapBackendEstado(estado: BackendEstadoCredito): CreditEstado {
  if (estado === 'desembolsado') return 'desembolsado';
  if (estado === 'pagado') return 'pagado';
  if (ESTADOS_EN_REVISION.includes(estado)) return 'pendiente';
  // default / expirado → no hay crédito activo que bloquee una nueva solicitud
  return 'ninguno';
}

/** Subset de un crédito que consume el móvil (GET /api/creditos → select('*')). */
export interface Credito {
  id: string;
  estado: BackendEstadoCredito;
  monto: string;
  moneda: string;
  uso: string;
  numero_cuotas: number;
  fecha_solicitud: string;
}

/** GET /api/creditos — lista ordenada por fecha_solicitud descendente. */
export function useCreditos() {
  return useApiQuery<{ creditos: Credito[] }>(queryKeys.creditos, '/api/creditos');
}

/**
 * Crédito relevante para la UI: prioriza el activo (en revisión o desembolsado)
 * sobre el histórico más reciente. El backend garantiza un solo activo a la vez.
 */
export function useCreditoActivo(): { credito: Credito | null; estado: CreditEstado; isLoading: boolean } {
  const { data, isLoading } = useCreditos();
  const creditos = data?.creditos ?? [];
  const activo = creditos.find(
    (c) => ESTADOS_EN_REVISION.includes(c.estado) || c.estado === 'desembolsado',
  );
  const relevante = activo ?? creditos[0] ?? null;
  return {
    credito: relevante,
    estado: relevante ? mapBackendEstado(relevante.estado) : 'ninguno',
    isLoading,
  };
}

export interface SolicitarCreditoVars {
  monto: number;
  uso: string;
  referadora_id: string;
  descripcion?: string;
  plazo_dias: number;
  numero_cuotas: number;
}

/** POST /api/creditos — al crear, invalida la lista para refrescar el estado. */
export function useSolicitarCredito() {
  return useApiMutation<unknown, SolicitarCreditoVars>(
    (vars, tokenOpts) => apiPost('/api/creditos', vars, tokenOpts),
    { invalidate: [queryKeys.creditos] },
  );
}
