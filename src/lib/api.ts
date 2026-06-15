// =============================================================================
// Mangle — API Client (Web Backend)
// =============================================================================
//
// HTTP client for calling the Mangle web API from the mobile app.
// Uses Bearer token auth (Supabase access_token) obtained via SIWE login.
//
// Features:
//   - GET/POST with Bearer token
//   - Auto-refresh on 401 (renueva el access_token vía refresh_token)
//   - Retry automático de la request original tras refresh exitoso
//
// Environment variable: VITE_API_URL (default: http://localhost:3000)
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiError {
  error: string;
  detail?: string;
  status?: number;
}

export class ApiRequestError extends Error {
  public code: string;
  public status: number;

  constructor(error: ApiError) {
    super(error.detail || error.error);
    this.code = error.error;
    this.status = error.status ?? 500;
    this.name = 'ApiRequestError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the web API base URL from environment or default.
 */
export function getApiBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL as string;
  }
  return 'http://localhost:3000';
}

// ---------------------------------------------------------------------------
// Network-error observer
// ---------------------------------------------------------------------------
// api.ts es INFRAESTRUCTURA: no conoce React ni AppState. Cuando una request
// no llega al servidor (TypeError de fetch — server caído o inalcanzable),
// emite un evento. La capa UI (BackendGuard) se suscribe y decide qué mostrar.
// Esto NO se dispara para respuestas 4xx/5xx: esas son ApiRequestError normales.
// ---------------------------------------------------------------------------

type NetworkErrorListener = () => void;

const networkErrorListeners = new Set<NetworkErrorListener>();

/**
 * Suscribe un listener que corre cuando una request no alcanza el servidor.
 * Devuelve la función de desuscripción (úsala en el cleanup de useEffect).
 */
export function onNetworkError(listener: NetworkErrorListener): () => void {
  networkErrorListeners.add(listener);
  return () => {
    networkErrorListeners.delete(listener);
  };
}

let isBackendDown = false;

function emitNetworkError(): void {
  isBackendDown = true;
  networkErrorListeners.forEach((listener) => listener());
}

/**
 * Función para probar si el backend volvió a estar en línea.
 * Si responde (aunque sea un 404 o 401), se considera arriba.
 */
export async function checkBackendStatus(): Promise<boolean> {
  try {
    const baseUrl = getApiBaseUrl();
    // Hacemos un ping a cualquier ruta, ej: el root o health check
    await fetch(`${baseUrl}/`, { method: 'HEAD', mode: 'no-cors' });
    
    // Si no tiró TypeError, el backend está arriba.
    isBackendDown = false;
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Token refresh mutex
// ---------------------------------------------------------------------------
// Evita que múltiples requests 401 disparen refrescos concurrentes.
// La primera request inicia el refresh; las demás esperan la misma Promise.
// ---------------------------------------------------------------------------

let refreshPromise: Promise<{ access_token: string; refresh_token: string } | null> | null = null;

async function doRefresh(
  baseUrl: string,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string } | null> {
  // Si ya hay un refresh en vuelo, únete a él
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) return null;

      const data = await res.json() as {
        access_token: string;
        refresh_token: string;
      };
      return data;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ---------------------------------------------------------------------------
// HTTP methods
// ---------------------------------------------------------------------------

export interface RequestOptions {
  token?: string | null;
  refreshToken?: string | null;
  /** Called when tokens are refreshed — actualiza AppState con los nuevos tokens */
  onTokenRefresh?: (token: string, refreshToken: string) => void;
  signal?: AbortSignal;
}

/**
 * GET request with optional Bearer token + auto-refresh.
 */
export async function apiGet<T = unknown>(
  path: string,
  options?: RequestOptions,
): Promise<T> {
  return request<T>('GET', path, undefined, options);
}

/**
 * POST request with JSON body and optional Bearer token + auto-refresh.
 */
export async function apiPost<T = unknown>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<T> {
  return request<T>('POST', path, body, options);
}

/**
 * PATCH request with JSON body and optional Bearer token + auto-refresh.
 * Usado, p. ej., por POST/PATCH /api/notificaciones/[id]/leer.
 */
export async function apiPatch<T = unknown>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return request<T>('PATCH', path, body, options);
}

// ---------------------------------------------------------------------------
// Core request
// ---------------------------------------------------------------------------

/**
 * Execute an HTTP request, auto-refreshing the bearer token if a 401 is
 * received and a refresh_token is available via options.refreshToken.
 *
 * After a successful refresh, the original request is retried transparently
 * with the new access token.
 */
async function request<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  if (isBackendDown) {
    // Si el backend ya se detectó como caído, bloqueamos cualquier otra
    // request de otras vistas devolviendo una promesa que nunca resuelve.
    // (Se limpia con el window.location.reload() del botón Reintentar.)
    return new Promise<T>(() => {});
  }

  const baseUrl = getApiBaseUrl();

  async function doFetch(token: string | null | undefined): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };


    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      return await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: options?.signal,
      });
    } catch (err) {
      // AbortError (request cancelada vía options.signal) NO es backend caído.
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      // TypeError "Failed to fetch" → el servidor no respondió (caído/inalcanzable).
      // Avisamos al guard y normalizamos a ApiRequestError (status 0) para que las
      // páginas que ya hacen `instanceof ApiRequestError` lo manejen igual.
      emitNetworkError();
      throw new ApiRequestError({
        error: 'BACKEND_UNREACHABLE',
        detail: 'No se pudo conectar con el servidor.',
        status: 0,
      });
    }
  }

  async function readBody(res: Response): Promise<unknown> {
    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return res.json();
    }
    return null;
  }

  // ---- 1. First attempt ----
  let res = await doFetch(options?.token);
  let data = await readBody(res);

  // ---- 2. Auto-refresh on 401 (mutex — un solo refresh concurrente) ----
  if (
    res.status === 401 &&
    options?.refreshToken &&
    options?.onTokenRefresh
  ) {
    const refreshData = await doRefresh(baseUrl, options.refreshToken);

    if (refreshData) {
      // Persist new tokens via callback
      options.onTokenRefresh(refreshData.access_token, refreshData.refresh_token);

      // ---- 3. Retry original request with new token ----
      res = await doFetch(refreshData.access_token);
      data = await readBody(res);
    }
  }

  // ---- 4. Handle non-JSON responses ----
  if (data === null) {
    if (!res.ok) {
      throw new ApiRequestError({
        error: 'ERROR_INTERNO',
        detail: `HTTP ${res.status}: ${res.statusText}`,
        status: res.status,
      });
    }
    return undefined as T;
  }

  // ---- 5. Error handling ----
  if (!res.ok) {
    throw new ApiRequestError({
      error: (data as Record<string, unknown>)?.error as string || 'ERROR_INTERNO',
      detail: (data as Record<string, unknown>)?.detail as string || `HTTP ${res.status}`,
      status: res.status,
    });
  }

  return data as T;
}
