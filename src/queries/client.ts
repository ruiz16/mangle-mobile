// =============================================================================
// QueryClient — configuración global de TanStack Query
// =============================================================================
//
// Server-state vive aquí (caché global, dedup, invalidación), NO en AppState.
// Reemplaza el patrón anterior de copiar respuestas del backend dentro del
// contexto y persistirlas en localStorage (fuente del bug de staleness).
// =============================================================================

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // El backend es la fuente de verdad. Refrescamos al volver a la pantalla.
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

// Claves de query centralizadas para evitar typos en invalidaciones.
export const queryKeys = {
  profile: ['profile'] as const,
  miGrupo: ['mi-grupo'] as const,
  creditos: ['creditos'] as const,
  cuotas: ['cuotas'] as const,
  score: ['score'] as const,
  eduProgreso: ['edu-progreso'] as const,
  copmBalance: (address: string | null) => ['copm-balance', address] as const,
};
