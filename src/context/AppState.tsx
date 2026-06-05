'use client';

// =============================================================================
// AppState — Global State Context for Mangle
// =============================================================================

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  AppState,
  LoanCategory,
  GaccMode,
  Municipio,
  Member,
} from '../types';
import { createDefaultState } from '../types';
import { getDefaultGaccMembers } from '../lib/data';

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface AppStateContextValue {
  state: AppState;

  // Actions
  connectWallet: (address: string) => void;
  setFullName: (name: string) => void;
  setRole: (role: string) => void;
  setPhone: (phone: string) => void;
  setMunicipio: (m: Municipio) => void;
  setReferidora: (r: string) => void;
  setGaccMode: (m: GaccMode) => void;
  setGaccCode: (code: string) => void;
  setGaccName: (name: string) => void;
  registerUser: () => void;
  advanceEdu: () => boolean; // returns true if completed
  setSelectedAmount: (amount: number) => void;
  setCategory: (cat: LoanCategory) => void;
  submitLoan: () => void;
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
  const [state, setState] = useState<AppState>(createDefaultState);

  // ---------- Wallet ----------

  const connectWallet = useCallback((address: string) => {
    setState((prev) => ({ ...prev, walletConnected: true, walletAddress: address }));
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

  // ---------- Register User ----------

  const registerUser = useCallback(() => {
    setState((prev) => {
      let gaccCode = prev.gaccCode;
      let         gaccName = prev.gaccName || 'Mi GACC';
      let gaccMembers: Member[] = [];

      if (prev.gaccMode === 'join') {
        const code = (gaccCode || '').toUpperCase();
        if (code.includes('TIMBIQUI') || code.includes('202')) {
          gaccMembers = getDefaultGaccMembers('timbiqui', prev.fullName, prev.reputation);
          gaccName = 'Saberes del Río';
          gaccCode = 'TIMBIQUI-202';
        } else {
          gaccMembers = getDefaultGaccMembers('guapi', prev.fullName, prev.reputation);
          gaccName = 'Tejiendo Sueños';
          gaccCode = 'GUAPI-101';
        }
      } else {
        // Create flow
        const randomId = Math.floor(100 + Math.random() * 900);
        gaccCode = `${prev.municipio.toUpperCase()}-${randomId}`;
        gaccName = prev.gaccName || 'Mi GACC';
        gaccMembers = [
          { name: prev.fullName, role: prev.role || 'Emprendedora', status: 'Al día', score: prev.reputation, self: true },
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
    setState((prev) => ({ ...prev, creditApproved: true }));
  }, []);

  const payInstallment = useCallback(() => {
    setState((prev) => {
      if (prev.installmentsPaid >= prev.totalInstallments) return prev;
      return {
        ...prev,
        installmentsPaid: prev.installmentsPaid + 1,
        reputation: Math.min(100, prev.reputation + 5),
      };
    });
  }, []);

  // ---------- Reset ----------

  const resetState = useCallback(() => {
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
        setFullName,
        setRole,
        setPhone,
        setMunicipio,
        setReferidora,
        setGaccMode,
        setGaccCode,
        setGaccName,
        registerUser,
        advanceEdu,
        setSelectedAmount,
        setCategory,
        submitLoan,
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
