// =============================================================================
// storage.ts — Wrapper resiliente de almacenamiento para MiniPay WebView
// =============================================================================
//
// MiniPay (Opera Mini Android WebView) puede bloquear o limpiar localStorage
// entre navegaciones. Este wrapper intenta localStorage primero y cae a
// sessionStorage si falla. En MiniPay, sessionStorage vive en memoria durante
// toda la sesión del WebView y es confiable.
//
// API idéntica a localStorage: getItem / setItem / removeItem
// =============================================================================

function isAvailable(storage: Storage): boolean {
  try {
    const key = '__mangle_test__';
    storage.setItem(key, '1');
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function getStorage(): Storage {
  if (typeof window === 'undefined') {
    // SSR / Node — devolver un storage en memoria no-op
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as unknown as Storage;
  }

  // Intentar localStorage primero
  if (isAvailable(window.localStorage)) return window.localStorage;

  // Fallback: sessionStorage (confiable en MiniPay WebView)
  if (isAvailable(window.sessionStorage)) return window.sessionStorage;

  // Último recurso: in-memory storage (se pierde al cerrar pero no rompe la app)
  const mem: Record<string, string> = {};
  return {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => { mem[k] = v; },
    removeItem: (k: string) => { delete mem[k]; },
    clear: () => { Object.keys(mem).forEach((k) => delete mem[k]); },
    key: (i: number) => Object.keys(mem)[i] ?? null,
    get length() { return Object.keys(mem).length; },
  } as unknown as Storage;
}

// Instancia única — se resuelve una vez y se reutiliza
let _storage: Storage | null = null;

function storage(): Storage {
  if (!_storage) _storage = getStorage();
  return _storage;
}

export const mangleStorage = {
  getItem(key: string): string | null {
    try {
      return storage().getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      storage().setItem(key, value);
    } catch {
      // storage lleno o bloqueado — ignorar silenciosamente
    }
  },

  removeItem(key: string): void {
    try {
      storage().removeItem(key);
    } catch {
      // noop
    }
  },
};
