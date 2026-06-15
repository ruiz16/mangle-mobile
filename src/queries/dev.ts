// =============================================================================
// Dev / Simulación — mutaciones contra el backend (NO estado local)
// =============================================================================
//
// Reemplaza triggerNodeAlert/restoreNodeAlert del antiguo AppState. La acción
// vive en el backend (POST /api/dev/alerta y /resolver): muta datos reales del
// usuario para que el semáforo del GACC, el score y el crédito reflejen una
// mora. El "estado anterior" (snapshot) lo devuelve el disparo; el cliente lo
// guarda y lo reenvía al resolver para restaurar.
// =============================================================================

import { apiPost } from '../lib/api';
import { useApiMutation } from './useApiQuery';
import { queryKeys } from './client';

/** Estado previo devuelto por el disparo; se reenvía al resolver. */
export interface AlertaSnapshot {
  cuota_id: string;
  estado_anterior: string;
  fecha_vencimiento_anterior: string;
  score_anterior: number;
}

interface DispararResponse {
  status: string;
  snapshot: AlertaSnapshot;
}

// Toda query que dependa de score / cuotas / semáforo del grupo debe refrescar.
const INVALIDATE = [
  queryKeys.miGrupo,
  queryKeys.cuotas,
  queryKeys.creditos,
  queryKeys.score,
  ['gacc-semaforo'],
  ['gacc-pendientes-aval'],
] as const;

/** POST /api/dev/alerta — dispara la mora simulada y devuelve el snapshot. */
export function useDispararAlerta() {
  return useApiMutation<DispararResponse, void>(
    (_vars, tokenOpts) => apiPost<DispararResponse>('/api/dev/alerta', {}, tokenOpts),
    { invalidate: INVALIDATE },
  );
}

/** POST /api/dev/alerta/resolver — restaura el estado previo desde el snapshot. */
export function useResolverAlerta() {
  return useApiMutation<unknown, AlertaSnapshot>(
    (snapshot, tokenOpts) => apiPost('/api/dev/alerta/resolver', snapshot, tokenOpts),
    { invalidate: INVALIDATE },
  );
}
