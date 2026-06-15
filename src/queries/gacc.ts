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

/**
 * Alerta de nodo derivada del semáforo del servidor (NO estado local).
 * `true` cuando el grupo NO está en verde (amarillo/rojo = hay mora real).
 * Reemplaza el antiguo `state.nodeAlert`.
 */
export function useNodeAlerta(): boolean {
  const { data } = useGaccSemaforo();
  return !!data && data.semaforo !== 'verde';
}

/** POST /api/avales — avalar un crédito; invalida pendientes y créditos. */
export function useAvalar() {
  return useApiMutation<unknown, string>(
    (creditoId, tokenOpts) => apiPost('/api/avales', { credito_id: creditoId }, tokenOpts),
    { invalidate: [pendientesKey, queryKeys.creditos] },
  );
}
