// =============================================================================
// Perfil del participante — server-state vía TanStack Query
// =============================================================================

import { useApiQuery } from './useApiQuery';
import { queryKeys } from './client';

export interface Participante {
  nombre: string;
  rol: string;
  telefono: string;
}

/** GET /api/participantes/me — perfil del usuario autenticado. */
export function useProfile() {
  return useApiQuery<{ participante: Participante }>(queryKeys.profile, '/api/participantes/me');
}

interface ScoreHistorialResponse {
  historial: { score_efectivo: number; antiguedad_meses: number };
}

/** GET /api/participantes/score/historial — score (reputación) + antigüedad. */
export function useScore() {
  const { data } = useApiQuery<ScoreHistorialResponse>(
    queryKeys.score,
    '/api/participantes/score/historial',
  );
  return {
    score: data?.historial.score_efectivo ?? 0,
    antiguedad: data?.historial.antiguedad_meses ?? 0,
  };
}
