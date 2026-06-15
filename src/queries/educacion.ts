// =============================================================================
// Educación — server-state vía TanStack Query (módulos + progreso)
// =============================================================================

import { apiPost } from '../lib/api';
import { useApiQuery, useApiMutation } from './useApiQuery';
import { queryKeys } from './client';
import type { ApiModulosResponse, ApiEduProgresoResponse } from '../types';

/** GET /api/educacion/modulos — lista pública de módulos. */
export function useModulos() {
  return useApiQuery<ApiModulosResponse>(['edu-modulos'], '/api/educacion/modulos', {
    staleTime: 5 * 60_000,
  });
}

export interface EduProgresoDerivado {
  step: number;
  total: number;
  progress: number; // 0–100
  completado: boolean;
  isLoading: boolean;
}

/** GET /api/educacion/progreso — progreso del usuario, ya derivado para la UI.
 *  staleTime Infinity: sólo cambia al avanzar un módulo, y eso invalida la query.
 *  Evita refetches innecesarios al navegar entre tabs o al recuperar foco. */
export function useEduProgreso(): EduProgresoDerivado {
  const { data, isLoading } = useApiQuery<ApiEduProgresoResponse>(
    queryKeys.eduProgreso,
    '/api/educacion/progreso',
    { staleTime: Infinity },
  );
  const p = data?.progreso;
  const total = p?.modulos_totales || 1;
  const step = p ? Math.min(p.modulo_actual, total) : 1;
  // Sin datos aún → progress 0 (no asumir completo durante la carga).
  const progress = !p ? 0 : p.completado ? 100 : Math.round((step / total) * 100);
  return { step, total, progress, completado: !!p?.completado, isLoading };
}

/** POST /api/educacion/progreso — avanzar de módulo; invalida el progreso. */
export function useAvanzarEducacion() {
  return useApiMutation<ApiEduProgresoResponse, number>(
    (moduloActual, tokenOpts) =>
      apiPost<ApiEduProgresoResponse>('/api/educacion/progreso', { modulo_actual: moduloActual }, tokenOpts),
    { invalidate: [queryKeys.eduProgreso] },
  );
}
