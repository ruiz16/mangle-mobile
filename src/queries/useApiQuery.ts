// =============================================================================
// useApiQuery / useApiMutation — wrappers de TanStack Query
// =============================================================================
//
// Inyectan token + refreshToken + onTokenRefresh desde el contexto de sesión,
// reutilizando apiGet/apiPost de src/lib/api.ts. Los hooks de dominio
// (useCreditos, useProfile, etc.) se construyen sobre estos.
// =============================================================================

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useAppState } from '../context/AppState';
import { apiGet, type RequestOptions } from '../lib/api';

/** Opciones de autenticación derivadas del contexto de sesión. */
export function useAuthTokenOpts(): RequestOptions {
  const { state, refreshTokens } = useAppState();
  return {
    token: state.authToken,
    refreshToken: state.refreshToken,
    onTokenRefresh: refreshTokens,
  };
}

/** GET autenticado cacheado por TanStack Query. Deshabilitado sin token. */
export function useApiQuery<T>(
  key: readonly unknown[],
  path: string,
  options?: { enabled?: boolean; staleTime?: number },
): UseQueryResult<T> {
  const tokenOpts = useAuthTokenOpts();
  return useQuery<T>({
    queryKey: key,
    queryFn: ({ signal }) => apiGet<T>(path, { ...tokenOpts, signal }),
    enabled: (options?.enabled ?? true) && !!tokenOpts.token,
    staleTime: options?.staleTime,
  });
}

/**
 * Mutación autenticada. `mutationFn` recibe las variables y las opciones de
 * token ya resueltas; tras éxito invalida las queryKeys indicadas.
 */
export function useApiMutation<TData, TVars = void>(
  mutationFn: (vars: TVars, tokenOpts: RequestOptions) => Promise<TData>,
  options?: { invalidate?: readonly (readonly unknown[])[] },
): UseMutationResult<TData, unknown, TVars> {
  const tokenOpts = useAuthTokenOpts();
  const qc = useQueryClient();
  return useMutation<TData, unknown, TVars>({
    mutationFn: (vars: TVars) => mutationFn(vars, tokenOpts),
    onSuccess: () => {
      options?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}
