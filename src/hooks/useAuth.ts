// =============================================================================
// useAuth — Auth state machine orchestrator for MANGLE
// =============================================================================
// La CONEXIÓN la maneja wagmi + RainbowKit:
//   - Dentro de MiniPay → auto-connect injected (App/MiniPayBridge).
//   - Fuera de MiniPay  → el usuario abre el modal de RainbowKit (connect()).
// Este hook observa useAccount y, con una address conectada, corre la auth:
//   - MiniPay (o SIWE_DISABLED) → /api/auth/minipay (por address).
//   - Otras wallets            → SIWE (nonce → firma → /api/auth/siwe).
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useMiniPay } from './useMiniPay';
import { useIsMiniPay } from '../lib/minipay';
import { useAppState } from '../context/AppState';
import { createSiweMessage } from '../lib/siwe';
import { getActiveChain } from '../lib/network';
import { apiGet, apiPost, ApiRequestError } from '../lib/api';
import type { AuthStep } from '../types';

// SIWE activo. MiniPay autentica por address; wallets externas FIRMAN SIWE.
//    👉 true SOLO para pruebas sin firma. NUNCA en producción.
const SIWE_DISABLED = false;

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

  const { address: account, isConnected } = useAccount();
  const inMiniPay = useIsMiniPay();
  const { openConnectModal } = useConnectModal();
  const { signMessage } = useMiniPay();

  const [step, setStep] = useState<AuthStep>(state.authStep);
  const [error, setError] = useState<string | null>(null);

  const guard = useRef({ ranForAddress: null as string | null, isRunning: false });

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

  const runAuthFlow = useCallback(async (walletAddress: string) => {
    if (guard.current.isRunning) return;
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
          setStep('authenticated');
          return;
        } catch (err) {
          clearAuth();
          if (err instanceof ApiRequestError && err.status === 0) {
            setError('No se pudo conectar con el servidor. Verificá tu conexión.');
            setStep('error');
            return;
          }
        }
      }

      connectWallet(walletAddress);

      if (inMiniPay || SIWE_DISABLED) {
        setStep('exchanging');
        const miniPayResult = await apiPost<{
          ok: boolean;
          isNewUser: boolean;
          profile_completed: boolean;
          access_token: string;
          refresh_token: string;
        }>('/api/auth/minipay', { address: walletAddress });

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
        setStep('fetching_nonce');
        const chainId = getActiveChain().id;
        const nonceResult = await apiGet<{ nonce: string }>(
          `/api/auth/nonce?wallet_address=${walletAddress}`,
        );

        setStep('signing');
        const siweMessage = createSiweMessage({
          address: walletAddress as `0x${string}`,
          chainId,
          nonce: nonceResult.nonce,
        });
        const signature = await signMessage(siweMessage, walletAddress as `0x${string}`);
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
    inMiniPay,
    signMessage,
    setSiweAuth,
    setAuthTokens,
    refreshTokens,
    clearAuth,
    connectWallet,
  ]);

  // Reset al desconectar → re-auth en la próxima conexión.
  useEffect(() => {
    if (!isConnected) guard.current.ranForAddress = null;
  }, [isConnected]);

  // Cambio de cuenta → limpiar y re-autenticar.
  useEffect(() => {
    if (account && guard.current.ranForAddress && guard.current.ranForAddress !== account) {
      clearAuth();
      guard.current.ranForAddress = null;
      setStep('idle');
      setError(null);
    }
  }, [account, clearAuth]);

  // Dispara auth cuando wagmi reporta address conectada.
  useEffect(() => {
    if (step === 'authenticated') return;
    if (isAuthLoading) return;
    if (!isConnected || !account) return;
    if (guard.current.ranForAddress === account) return;
    guard.current.ranForAddress = account;
    runAuthFlow(account);
  }, [isConnected, account, step, isAuthLoading, runAuthFlow]);

  const retry = useCallback(() => {
    guard.current.ranForAddress = null;
    setStep('idle');
    setError(null);
  }, []);

  const connect = useCallback(() => {
    setError(null);
    openConnectModal?.();
  }, [openConnectModal]);

  const connectorType = inMiniPay ? 'MiniPay' : isConnected ? 'tu billetera' : 'No disponible';
  const needsManualConnect = !inMiniPay && !isConnected && !isAuthenticated && !isAuthLoading;

  return {
    step,
    error,
    isAuthenticated,
    isAuthLoading,
    retry,
    connect,
    connectorType,
    isMiniPay: inMiniPay,
    needsManualConnect,
    address: account || state.walletAddress,
  };
}
