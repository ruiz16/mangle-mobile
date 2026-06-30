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
import { mangleStorage } from '../lib/storage';

const STORAGE_KEY = 'mangle:state';

function loadSavedState(): AppState {
  try {
    const raw = mangleStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'walletConnected' in parsed) {
        return { ...createDefaultState(), ...parsed } as AppState;
      }
    }
  } catch {
    // storage corrupto o inexistente — usar default
  }
  return createDefaultState();
}

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
  // ✅ FIX: guard eliminado. El guard anterior bloqueaba clearAuth() — cuando
  // los tokens eran borrados del estado React, el storage NO se actualizaba
  // y los tokens expirados quedaban atrapados. Esto causaba un loop infinito:
  // load stale token → 401 → clearAuth() → load stale token de storage → ...
  // El storage ahora siempre refleja el estado actual sin excepción.
  const session: Partial<AppState> = {};
  for (const key of SESSION_KEYS) {
    (session as Record<string, unknown>)[key] = state[key];
  }
  mangleStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface AppStateContextValue {
  state: AppState;
  connectWallet: (address: string) => void;
  setAuthStep: (step: AuthStep) => void;
  setSiweAuth: (message: string, signature: `0x${string}`) => void;
  setAuthTokens: (token: string, refreshToken: string, isNewUser?: boolean, profileCompleted?: boolean) => void;
  refreshTokens: (token: string, refreshToken: string) => void;
  clearAuth: () => void;
  registerUser: () => void;
  resetState: () => void;
  showErrorModal: (title: string, message: string, action?: { label: string; href: string }) => void;
  clearErrorModal: () => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadSavedState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const connectWallet = useCallback((address: string) => {
    setState((prev) => ({ ...prev, walletConnected: true, walletAddress: address }));
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
    // ✅ FIX: limpiar storage explicitamente al cerrar sesión.
    // Sin esto, tokens expirados quedaban en storage y se recargaban
    // en el próximo render, causando loops de refresh fallido.
    mangleStorage.removeItem(STORAGE_KEY);
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
    setState((prev) => ({ ...prev, authToken: token, refreshToken }));
  }, []);

  const registerUser = useCallback(() => {
    setState((prev) => ({ ...prev, registered: true }));
  }, []);

  const resetState = useCallback(() => {
    mangleStorage.removeItem(STORAGE_KEY);
    setState(createDefaultState());
  }, []);

  const showErrorModal = useCallback((title: string, message: string, action?: { label: string; href: string }) => {
    setState((prev) => ({ ...prev, errorModal: { title, message, action } }));
  }, []);

  const clearErrorModal = useCallback(() => {
    setState((prev) => ({ ...prev, errorModal: null }));
  }, []);

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
        showErrorModal,
        clearErrorModal,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState debe usarse dentro de un <AppStateProvider>');
  return ctx;
}
