// =============================================================================
// useAuth — Auth state machine orchestrator for MANGLE
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { createWalletClient, custom } from 'viem';
import { useMiniPay } from './useMiniPay';
import { useAppState } from '../context/AppState';
import { createSiweMessage } from '../lib/siwe';
import { getActiveChain } from '../lib/network';
import { apiGet, apiPost, ApiRequestError } from '../lib/api';
import type { AuthStep } from '../types';

export function useAuth() {
  const {
    state,
    setAuthStep,
    setSiweAuth,
    setAuthTokens,
    refreshTokens,
    clearAuth,
    connectWallet,
  } = useAppState();

  const { address: walletAddress, isAvailable, signMessage } = useMiniPay();

  const [step, setStep] = useState<AuthStep>(state.authStep);
  const [error, setError] = useState<string | null>(null);

  const guard = useRef({ attempted: false, lastAddress: null as string | null, isRunning: false });

  const isAuthenticated = step === 'authenticated';
  const isAuthLoading =
    step === 'checking_session' ||
    step === 'connecting_wallet' ||
    step === 'fetching_nonce' ||
    step === 'signing' ||
    step === 'exchanging';

  useEffect(() => {
    if (step !== state.authStep) setAuthStep(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (step === 'authenticated' && walletAddress && guard.current.lastAddress !== walletAddress) {
      clearAuth();
      guard.current.attempted = false;
      guard.current.lastAddress = walletAddress;
      setStep('idle');
      setError(null);
    }
  }, [walletAddress, step, clearAuth]);

  const runAuthFlow = useCallback(async () => {
    if (guard.current.isRunning) return;
    guard.current.attempted = true;
    guard.current.isRunning = true;

    try {
      setStep('checking_session');
      setError(null);

      const savedToken = state.authToken;
      if (savedToken) {
        try {
          await apiGet('/api/participantes/me', {
            token: savedToken,
            refreshToken: state.refreshToken,
            onTokenRefresh: refreshTokens,
          });
          // ✅ sesión válida y usuario completo — autenticado
          setStep('authenticated');
          return;
        } catch (err) {
          // En cualquier error (401, 404, 5xx, red) — limpiar y hacer login fresco.
          // FIX: antes el 404 marcaba 'authenticated' sin pasar por el login de
          // MiniPay, causando que nunca se llamara a /api/auth/minipay.
          clearAuth();
          // Si es un error de red (5xx, no hay internet), dejar reintentar
          if (err instanceof ApiRequestError && err.status === 0) {
            setError('No se pudo conectar con el servidor. Verificá tu conexión.');
            setStep('error');
            guard.current.attempted = false;
            return;
          }
          // Para 401, 404 o cualquier otro — continuar al flow de login
        }
      }

      // ── Connect wallet ────────────────────────────────────────────────
      setStep('connecting_wallet');

      const provider =
        typeof window !== 'undefined' ? (window as unknown as { ethereum?: any }).ethereum : null;

      if (!provider) {
        throw new Error('No se encontró una wallet. Abrí esta app en MiniPay.');
      }

      // ✅ leer isMiniPay directo del provider (evita race condition del primer render)
      const currentIsMiniPay = !!(provider as any)?.isMiniPay;

      let address: string;
      try {
        const accounts: string[] = await provider.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          address = accounts[0]!;
        } else {
          const walletClient = createWalletClient({ transport: custom(provider) });
          const requested: string[] = await walletClient.requestAddresses();
          if (!requested.length) throw new Error('No se obtuvo acceso a la wallet.');
          address = requested[0]!;
        }
      } catch (walletErr: any) {
        throw new Error(walletErr?.message || 'No se pudo conectar la wallet.');
      }

      connectWallet(address);
      guard.current.lastAddress = address;

      // ── Bifurcar por tipo de wallet ─────────────────────────────────────
      if (currentIsMiniPay) {
        setStep('exchanging');
        const miniPayResult = await apiPost<{
          ok: boolean;
          isNewUser: boolean;
          profile_completed: boolean;
          access_token: string;
          refresh_token: string;
        }>('/api/auth/minipay', { address });

        if (!miniPayResult.access_token) {
          throw new Error('El servidor no devolvió un token de acceso.');
        }
        setAuthTokens(
          miniPayResult.access_token,
          miniPayResult.refresh_token,
          miniPayResult.isNewUser,
          miniPayResult.profile_completed,
        );
        setStep('authenticated');

      } else {
        // MetaMask — SIWE completo
        setStep('fetching_nonce');
        const chainId = getActiveChain().id;
        const nonceResult = await apiGet<{ nonce: string }>(
          `/api/auth/nonce?wallet_address=${address}`,
        );

        setStep('signing');
        const siweMessage = createSiweMessage({
          address: address as `0x${string}`,
          chainId,
          nonce: nonceResult.nonce,
        });
        const signature = await signMessage(siweMessage, address as `0x${string}`);
        setSiweAuth(siweMessage, signature);

        setStep('exchanging');
        const authResult = await apiPost<{
          ok: boolean;
          isNewUser: boolean;
          profile_completed: boolean;
          access_token: string;
          refresh_token: string;
        }>('/api/auth/siwe', { message: siweMessage, signature });

        if (!authResult.access_token) {
          throw new Error('El servidor no devolvió un token de acceso.');
        }
        setAuthTokens(authResult.access_token, authResult.refresh_token, authResult.isNewUser, authResult.profile_completed);
        setStep('authenticated');
      }

    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Error de autenticación.';
      setError(msg);
      setStep('error');
    } finally {
      guard.current.isRunning = false;
    }
  }, [
    state.authToken,
    state.refreshToken,
    signMessage,
    setSiweAuth,
    setAuthTokens,
    refreshTokens,
    clearAuth,
    connectWallet,
  ]);

  useEffect(() => {
    if (step === 'authenticated') return;
    if (isAuthLoading) return;

    // Esperar a que MiniPay inyecte window.ethereum
    const providerReady = typeof window !== 'undefined' && !!(window as any).ethereum;
    if (!providerReady) return;

    if (guard.current.attempted) {
      const currentAddr = state.walletAddress || walletAddress;
      if (!currentAddr || currentAddr.toLowerCase() === guard.current.lastAddress?.toLowerCase()) return;
      guard.current.attempted = false;
      guard.current.lastAddress = currentAddr;
    }

    runAuthFlow();
  }, [step, state.walletAddress, walletAddress, runAuthFlow, isAuthLoading]);

  const retry = useCallback(() => {
    guard.current.attempted = false;
    guard.current.lastAddress = null;
    setStep('idle');
    setError(null);
  }, []);

  const isMiniPayNow = typeof window !== 'undefined' && !!(window as any).ethereum?.isMiniPay;
  const connectorType = isMiniPayNow ? 'MiniPay' : isAvailable ? 'MetaMask' : 'No disponible';

  return {
    step,
    error,
    isAuthenticated,
    isAuthLoading,
    retry,
    connectorType,
    address: walletAddress || state.walletAddress,
  };
}
