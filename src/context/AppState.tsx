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
  LoanCategory,
  CreditEstado,
  Moneda,
  GaccMode,
  Municipio,
  Member,
} from '../types';
import { createDefaultState } from '../types';
import { getDefaultGaccMembers } from '../lib/data';
import { getExchangeRate, copmToCusd } from '../lib/currency';

const STORAGE_KEY = 'mangle:state';

function loadSavedState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'walletConnected' in parsed) {
        return parsed as AppState;
      }
    }
  } catch {
    // localStorage corrupto, lleno o inexistente — usar default
  }
  return createDefaultState();
}

function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage lleno o no disponible — silencio
  }
}

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface AppStateContextValue {
  state: AppState;

  // Actions
  connectWallet: (address: string, copmBalance?: string) => void;
  setCopmBalance: (value: string) => void;
  setSiweAuth: (message: string, signature: `0x${string}`) => void;
  setAuthTokens: (token: string, refreshToken: string) => void;
  setFullName: (name: string) => void;
  setRole: (role: string) => void;
  setPhone: (phone: string) => void;
  setMunicipio: (m: Municipio) => void;
  setReferidora: (r: string) => void;
  setGaccMode: (m: GaccMode) => void;
  setGaccCode: (code: string) => void;
  setGaccName: (name: string) => void;
  setGaccMembers: (members: Member[]) => void;
  registerUser: () => void;
  advanceEdu: () => boolean; // returns true if completed
  setSelectedAmount: (amount: number) => void;
  setCategory: (cat: LoanCategory) => void;
  submitLoan: () => void;
  approveLoan: () => void;
  payInstallment: () => void;
  resetState: () => void;

  // Dev / Alert triggers
  triggerNodeAlert: () => void;
  restoreNodeAlert: () => void;
  addReputation: (points: number) => void;
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

  const connectWallet = useCallback((address: string, copmBalance?: string) => {
    setState((prev) => ({
      ...prev,
      walletConnected: true,
      walletAddress: address,
      copmBalance: copmBalance ?? prev.copmBalance,
    }));
  }, []);

  const setCopmBalance = useCallback((value: string) => {
    setState((prev) => ({ ...prev, copmBalance: value }));
  }, []);

  const setSiweAuth = useCallback((message: string, signature: `0x${string}`) => {
    setState((prev) => ({ ...prev, siweMessage: message, siweSignature: signature }));
  }, []);

  const setAuthTokens = useCallback((token: string, refreshToken: string) => {
    setState((prev) => ({ ...prev, authToken: token, refreshToken }));
  }, []);

  // ---------- Registration fields ----------

  const setFullName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, fullName: name }));
  }, []);
  const setRole = useCallback((role: string) => {
    setState((prev) => ({ ...prev, role }));
  }, []);
  const setPhone = useCallback((phone: string) => {
    setState((prev) => ({ ...prev, phone }));
  }, []);
  const setMunicipio = useCallback((m: Municipio) => {
    setState((prev) => ({ ...prev, municipio: m }));
  }, []);
  const setReferidora = useCallback((r: string) => {
    setState((prev) => ({ ...prev, referidora: r }));
  }, []);
  const setGaccMode = useCallback((m: GaccMode) => {
    setState((prev) => ({ ...prev, gaccMode: m }));
  }, []);
  const setGaccCode = useCallback((code: string) => {
    setState((prev) => ({ ...prev, gaccCode: code }));
  }, []);
  const setGaccName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, gaccName: name }));
  }, []);
  const setGaccMembers = useCallback((members: Member[]) => {
    setState((prev) => ({ ...prev, gaccMembers: members }));
  }, []);

  // ---------- Register User ----------

  const registerUser = useCallback(() => {
    setState((prev) => {
      let gaccCode = prev.gaccCode;
      let         gaccName = prev.gaccName || 'Mi GACC';
      let gaccMembers: Member[] = [];

      if (prev.gaccMode === 'join') {
        const code = (gaccCode || '').toUpperCase();
        if (code.includes('TIMBIQUI')) {
          gaccMembers = getDefaultGaccMembers('timbiqui', prev.fullName, prev.reputation);
          gaccName = 'Saberes del Río';
          gaccCode = 'MANGLE-TIMBIQUI';
        } else {
          gaccMembers = getDefaultGaccMembers('guapi', prev.fullName, prev.reputation);
          gaccName = 'Tejiendo Sueños';
          gaccCode = 'MANGLE-GUAPI';
        }
      } else {
        // Create flow — generates MANGLE-XXXX code
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const selfId = `mock-miembro-${Date.now()}`;
        gaccCode = `MANGLE-${code}`;
        gaccName = prev.gaccName || 'Mi GACC';
        gaccMembers = [
          { id: selfId, participanteId: `mock-part-${selfId}`, name: prev.fullName, role: prev.role || 'Emprendedora', status: 'Al día', score: prev.reputation, validado: true, self: true },
        ];
      }

      return {
        ...prev,
        registered: true,
        gaccCode,
        gaccName,
        gaccMembers,
      };
    });
  }, []);

  // ---------- Education ----------

  const advanceEdu = useCallback((): boolean => {
    let completed = false;
    setState((prev) => {
      const nextStep = prev.currentEduStep + 1;
      const totalSteps = 4; // from EDU_CONVERSATION
      if (nextStep > totalSteps) {
        completed = true;
        return { ...prev, eduProgress: 100 };
      }
      const progress = Math.round((nextStep / totalSteps) * 100);
      return { ...prev, currentEduStep: nextStep, eduProgress: progress };
    });
    return completed;
  }, []);

  // ---------- Credit ----------

  const setSelectedAmount = useCallback((amount: number) => {
    setState((prev) => ({ ...prev, selectedAmount: amount }));
  }, []);
  const setCategory = useCallback((cat: LoanCategory) => {
    setState((prev) => ({ ...prev, category: cat }));
  }, []);

  const submitLoan = useCallback(() => {
    setState((prev) => {
      const tasaCambio = getExchangeRate();
      const montoCusd = copmToCusd(prev.selectedAmount, tasaCambio);
      return {
        ...prev,
        creditEstado: 'pendiente',
        moneda: 'COPm',
        montoCusd,
        tasaCambio,
      };
    });
  }, []);

  const approveLoan = useCallback(() => {
    setState((prev) => {
      if (prev.creditEstado !== 'pendiente') return prev;
      return { ...prev, creditEstado: 'desembolsado' };
    });
  }, []);

  const payInstallment = useCallback(() => {
    setState((prev) => {
      if (prev.installmentsPaid >= prev.totalInstallments) return prev;
      const newPaid = prev.installmentsPaid + 1;
      const isComplete = newPaid >= prev.totalInstallments;
      return {
        ...prev,
        installmentsPaid: newPaid,
        creditEstado: isComplete ? 'pagado' : prev.creditEstado,
        reputation: Math.min(100, prev.reputation + 5),
      };
    });
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
        reputation: Math.max(50, prev.reputation - 15),
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
        reputation: Math.min(100, prev.reputation + 10),
        gaccMembers: updatedMembers.length > 0 ? updatedMembers : prev.gaccMembers,
      };
    });
  }, []);

  const addReputation = useCallback((points: number) => {
    setState((prev) => ({
      ...prev,
      reputation: Math.max(0, Math.min(100, prev.reputation + points)),
    }));
  }, []);

  // ---------- Provide ----------

  return (
    <AppStateContext.Provider
      value={{
        state,
        connectWallet,
        setCopmBalance,
        setSiweAuth,
        setAuthTokens,
        setFullName,
        setRole,
        setPhone,
        setMunicipio,
        setReferidora,
        setGaccMode,
        setGaccCode,
        setGaccName,
        setGaccMembers,
        registerUser,
        advanceEdu,
        setSelectedAmount,
        setCategory,
        submitLoan,
        approveLoan,
        payInstallment,
        resetState,
        triggerNodeAlert,
        restoreNodeAlert,
        addReputation,
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
