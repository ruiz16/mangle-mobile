// =============================================================================
// Mangle — API Client (Web Backend)
// =============================================================================
//
// HTTP client for calling the Mangle web API from the mobile app.
// Uses Bearer token auth (Supabase access_token) obtained via SIWE login.
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
// HTTP methods
// ---------------------------------------------------------------------------

interface RequestOptions {
  token?: string | null;
  signal?: AbortSignal;
}

/**
 * GET request with optional Bearer token.
 */
export async function apiGet<T = unknown>(
  path: string,
  options?: RequestOptions,
): Promise<T> {
  return request<T>('GET', path, undefined, options);
}

/**
 * POST request with JSON body and optional Bearer token.
 */
export async function apiPost<T = unknown>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<T> {
  return request<T>('POST', path, body, options);
}

// ---------------------------------------------------------------------------
// Core request
// ---------------------------------------------------------------------------

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options?.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: options?.signal,
  });

  // Handle non-JSON responses
  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    if (!res.ok) {
      throw new ApiRequestError({
        error: 'ERROR_INTERNO',
        detail: `HTTP ${res.status}: ${res.statusText}`,
        status: res.status,
      });
    }
    return undefined as T;
  }

  const data = await res.json();

  if (!res.ok) {
    throw new ApiRequestError({
      error: data.error || 'ERROR_INTERNO',
      detail: data.detail || `HTTP ${res.status}`,
      status: res.status,
    });
  }

  return data as T;
}
