'use client';

// =============================================================================
// AppState — Global State Context for Mangle
// =============================================================================

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type {
  AppState,
  AuthStep,
} from '../types';
import { createDefaultState } from '../types';

const STORAGE_KEY = 'mangle:state';

function loadSavedState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'walletConnected' in parsed) {
        // Sólo se persiste el slice de sesión; el resto se hidrata del default.
        return { ...createDefaultState(), ...parsed } as AppState;
      }
    }
  } catch {
    // localStorage corrupto, lleno o inexistente — usar default
  }
  return createDefaultState();
}

// Sólo el slice de SESIÓN se persiste. Los datos del servidor viven en
// TanStack Query y NUNCA tocan localStorage (evita el bug de staleness).
const SESSION_KEYS = [
  'walletConnected',
  'walletAddress',
  'registered',
  'authStep',
  'siweMessage',
  'siweSignature',
  'authToken',
  'refreshToken',
] as const satisfies readonly (keyof AppState)[];

function saveState(state: AppState): void {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const saved = JSON.parse(raw);
      if ((saved.authToken || saved.registered) && !state.authToken && !state.registered) {
        return; // 🛡️ no pisar datos reales con estado vacío
      }
    } catch { /* ignorar parseo corrupto */ }
  }
  const session: Partial<AppState> = {};
  for (const key of SESSION_KEYS) {
    (session as Record<string, unknown>)[key] = state[key];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface AppStateContextValue {
  state: AppState;

  // Actions
  connectWallet: (address: string) => void;
  setAuthStep: (step: AuthStep) => void;
  setSiweAuth: (message: string, signature: `0x${string}`) => void;
  setAuthTokens: (token: string, refreshToken: string, isNewUser?: boolean, profileCompleted?: boolean) => void;
  refreshTokens: (token: string, refreshToken: string) => void;
  clearAuth: () => void;
  registerUser: () => void;
  resetState: () => void;

  // Dev / Alert triggers
  triggerNodeAlert: () => void;
  restoreNodeAlert: () => void;

  // Blocking error modal
  showErrorModal: (title: string, message: string) => void;
  clearErrorModal: () => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadSavedState);

  // Persist on every state change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // ---------- Wallet ----------

  const connectWallet = useCallback((address: string) => {
    setState((prev) => ({
      ...prev,
      walletConnected: true,
      walletAddress: address,
    }));
  }, []);

  const setAuthStep = useCallback((step: AuthStep) => {
    setState((prev) => ({ ...prev, authStep: step }));
  }, []);

  const setSiweAuth = useCallback((message: string, signature: `0x${string}`) => {
    setState((prev) => ({ ...prev, siweMessage: message, siweSignature: signature }));
  }, []);

  const setAuthTokens = useCallback((token: string, refreshToken: string, _isNewUser?: boolean, profileCompleted?: boolean) => {
    setState((prev) => ({
      ...prev,
      authToken: token,
      refreshToken,
      authStep: 'authenticated',
      registered: profileCompleted ?? false,
    }));
  }, []);

  const clearAuth = useCallback(() => {
    setState((prev) => ({
      ...prev,
      authStep: 'idle',
      siweMessage: null,
      siweSignature: null,
      authToken: null,
      refreshToken: null,
    }));
  }, []);

  const refreshTokens = useCallback((token: string, refreshToken: string) => {
    setState((prev) => ({
      ...prev,
      authToken: token,
      refreshToken,
    }));
  }, []);

  // ---------- Register User ----------

  const registerUser = useCallback(() => {
    setState((prev) => ({ ...prev, registered: true }));
  }, []);

  // ---------- Reset ----------

  const resetState = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(createDefaultState());
  }, []);

  // ---------- Dev / Alert triggers ----------

  const triggerNodeAlert = useCallback(() => {
    setState((prev) => {
      const partnerName = prev.municipio === 'guapi' ? 'María Estela Cuero' : 'Xiomara Carabalí';

      // Update GACC members: find the partner and set to alert
      const updatedMembers = prev.gaccMembers.map((m) => {
        const first = partnerName.split(' ')[0] ?? '';
        if (m.name.includes(first)) {
          return { ...m, status: 'En Alerta' as const, score: Math.max(60, m.score - 15) };
        }
        return m;
      });

      return {
        ...prev,
        nodeAlert: true,
        alertPartnerName: partnerName,
        gaccMembers: updatedMembers.length > 0 ? updatedMembers : prev.gaccMembers,
      };
    });
  }, []);

  const restoreNodeAlert = useCallback(() => {
    setState((prev) => {
      const updatedMembers = prev.gaccMembers.map((m) => {
        const first = (prev.alertPartnerName ?? '').split(' ')[0] ?? '';
        if (m.name.includes(first)) {
          return { ...m, status: 'Al día' as const, score: Math.min(100, m.score + 15) };
        }
        return m;
      });

      return {
        ...prev,
        nodeAlert: false,
        alertPartnerName: '',
        gaccMembers: updatedMembers.length > 0 ? updatedMembers : prev.gaccMembers,
      };
    });
  }, []);

  const showErrorModal = useCallback((title: string, message: string) => {
    setState((prev) => ({ ...prev, errorModal: { title, message } }));
  }, []);

  const clearErrorModal = useCallback(() => {
    setState((prev) => ({ ...prev, errorModal: null }));
  }, []);

  // ---------- Provide ----------

  return (
    <AppStateContext.Provider
      value={{
        state,
        connectWallet,
        setAuthStep,
        setSiweAuth,
        setAuthTokens,
        clearAuth,
        refreshTokens,
        registerUser,
        resetState,
        triggerNodeAlert,
        restoreNodeAlert,
        showErrorModal,
        clearErrorModal,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState debe usarse dentro de un <AppStateProvider>');
  }
  return ctx;
}
