// =============================================================================
// GACC — server-state vía TanStack Query (grupo, miembros, avales, semáforo)
// =============================================================================

import { apiPost } from '../lib/api';
import { useApiQuery, useApiMutation } from './useApiQuery';
import { queryKeys } from './client';
import type { Member } from '../types';

// ---------------------------------------------------------------------------
// Mi grupo (/api/gacc/mi-grupo)
// ---------------------------------------------------------------------------

interface MiGrupoRaw {
  grupo: { id: number; nombre: string; codigo: string; municipio: string; lider_id: string | null } | null;
  miembro: { id: number } | null;
  miembros: Array<{
    id: number;
    participante_id: number;
    validado_en: string | null;
    participante: { nombre: string; score_reputacion: number } | null;
  }>;
}

export interface MiGrupo {
  nombre: string;
  codigo: string;
  municipio: string;
  members: Member[];
}

function mapMiGrupo(raw: MiGrupoRaw): MiGrupo | null {
  if (!raw.grupo) return null;
  const selfId = raw.miembro?.id ?? 0;
  const liderId = raw.grupo.lider_id;
  const members: Member[] = (raw.miembros ?? []).map((m) => ({
    id: String(m.id),
    participanteId: String(m.participante_id),
    name: m.participante?.nombre ?? '',
    // El Líder Social es un rol fijo del grupo (grupos_gacc.lider_id).
    // La referadora NO es un rol fijo: se elige por crédito.
    role: liderId != null && String(m.participante_id) === String(liderId) ? 'Líder Social' : 'Miembro',
    status: m.validado_en ? 'Al día' : 'En Alerta',
    score: m.participante?.score_reputacion ?? 50,
    validado: !!m.validado_en,
    self: m.id === selfId,
  }));
  return {
    nombre: raw.grupo.nombre,
    codigo: raw.grupo.codigo,
    municipio: raw.grupo.municipio,
    members,
  };
}

/** GET /api/gacc/mi-grupo — grupo + miembros ya mapeados a la forma de UI. */
export function useMiGrupo(): { grupo: MiGrupo | null; isLoading: boolean } {
  const { data, isLoading } = useApiQuery<MiGrupoRaw>(queryKeys.miGrupo, '/api/gacc/mi-grupo');
  return { grupo: data ? mapMiGrupo(data) : null, isLoading };
}

// ---------------------------------------------------------------------------
// Pendientes de aval + semáforo
// ---------------------------------------------------------------------------

export interface PendingAvalCredit {
  id: string;
  prestatario_id: string;
  prestatario_nombre: string;
  monto: string;
  descripcion: string | null;
  fecha_solicitud: string;
  avales_minimos: number;
  avales_actuales: number;
  referadora_nombre: string | null;
  aval_referadora_hecho: boolean;
  aval_lider_hecho: boolean;
  mi_rol: 'referadora' | 'lider' | null;
  puedo_avalar: boolean;
  ya_avale: boolean;
  es_propio: boolean;
}

export interface GaccStats {
  score_gacc: number;
  semaforo: 'verde' | 'amarillo' | 'rojo';
  estado: string;
  es_lider: boolean;
}

const pendientesKey = ['gacc-pendientes-aval'] as const;

/** GET /api/gacc/pendientes-de-aval — créditos esperando aval. */
export function usePendientesAval() {
  return useApiQuery<{ creditos: PendingAvalCredit[] }>(
    pendientesKey,
    '/api/gacc/pendientes-de-aval',
  );
}

/** GET /api/gacc/semaforo — score colectivo + estado de mora. */
export function useGaccSemaforo() {
  return useApiQuery<GaccStats>(['gacc-semaforo'], '/api/gacc/semaforo');
}

// ---------------------------------------------------------------------------
// Mi alerta — alerta de mora PERSONALIZADA por relación (privacidad)
// ---------------------------------------------------------------------------
//
// A diferencia del semáforo grupal (color público), esta alerta solo aparece si
// la mora le concierne al usuario: crédito propio, donde es referidora, o si es
// el Líder Social del GACC. El nombre del deudor solo se expone a referidora y
// líder. Reemplaza al antiguo `state.nodeAlert` (estado local).
// ---------------------------------------------------------------------------

export type RolAlerta = 'propio' | 'referadora' | 'lider';

export interface MiAlerta {
  alerta: boolean;
  rol: RolAlerta | null;
  deudor_nombre: string | null;
  dias_mora: number;
  total_moras: number;
}

const SIN_ALERTA: MiAlerta = {
  alerta: false,
  rol: null,
  deudor_nombre: null,
  dias_mora: 0,
  total_moras: 0,
};

/** GET /api/gacc/mi-alerta — ¿hay una mora que me concierne? (con nombre si aplica). */
export function useMiAlerta(): MiAlerta {
  const { data } = useApiQuery<MiAlerta>(['gacc-mi-alerta'], '/api/gacc/mi-alerta');
  return data ?? SIN_ALERTA;
}

/** Texto del banner según el rol del usuario frente a la mora. */
export function mensajeAlerta(a: MiAlerta): string {
  if (!a.alerta) return '';
  if (a.rol === 'propio') {
    return 'Tienes una cuota en mora. Regulariza tu pago para no comprometer la garantía social de tu grupo.';
  }
  if (a.rol === 'referadora') {
    return `Tu referida ${a.deudor_nombre ?? ''} tiene una cuota en mora. Tu red tiene 48h para apoyarla antes de suspender el nodo.`;
  }
  // lider
  const extra = a.total_moras > 1 ? ` (y ${a.total_moras - 1} más)` : '';
  return `${a.deudor_nombre ?? 'Un miembro'}${extra} de tu grupo presenta mora. Como Líder Social, coordina la regularización en las próximas 48h.`;
}

/** POST /api/avales — avalar un crédito; invalida pendientes y créditos. */
export function useAvalar() {
  return useApiMutation<unknown, string>(
    (creditoId, tokenOpts) => apiPost('/api/avales', { credito_id: creditoId }, tokenOpts),
    { invalidate: [pendientesKey, queryKeys.creditos] },
  );
}
