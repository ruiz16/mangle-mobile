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

// SIWE activo. MiniPay conecta implícitamente y autentica por address
// (/api/auth/minipay), pero las wallets externas tipo MetaMask FIRMAN el mensaje
// SIWE (/api/auth/siwe) como prueba de posesión de la clave privada. Backend:
// src/app/api/auth/siwe/route.ts (verificación EIP-4361 completa).
//    👉 Poner en `true` SOLO para pruebas rápidas sin firma. NUNCA en producción.
const SIWE_DISABLED = false;

/**
 * Entorno de wallet detectado:
 * - 'detecting': todavía esperando a que se inyecte window.ethereum (MiniPay lo
 *   hace con un pequeño delay tras el load).
 * - 'minipay': corriendo DENTRO de MiniPay → conexión implícita, sin botón.
 * - 'injected': hay una wallet EIP-1193 (MetaMask u otra) pero NO es MiniPay →
 *   la conexión requiere un gesto del usuario (click). Se muestra botón.
 * - 'none': navegador sin ninguna wallet → pantalla "instalá una wallet".
 */
export type WalletEnv = 'detecting' | 'minipay' | 'injected' | 'none';

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

  // ── Detección de entorno de wallet ──────────────────────────────────────
  // MiniPay inyecta window.ethereum DESPUÉS del primer render, así que hacemos
  // un poll corto antes de concluir 'none'. `preAuthorized` = la wallet ya
  // autorizó una cuenta (eth_accounts no vacío) → podemos conectar sin popup.
  const [env, setEnv] = useState<WalletEnv>('detecting');
  const [preAuthorized, setPreAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;

    const detect = async () => {
      if (cancelled) return;
      const eth = typeof window !== 'undefined' ? (window as any).ethereum : undefined;

      if (eth) {
        if (eth.isMiniPay) {
          setEnv('minipay');
          return;
        }
        // Wallet inyectada que NO es MiniPay (MetaMask, etc.)
        try {
          const accs: string[] = await eth.request({ method: 'eth_accounts' });
          if (!cancelled) setPreAuthorized(accs.length > 0);
        } catch {
          /* la wallet puede rechazar eth_accounts si está bloqueada — ignorar */
        }
        if (!cancelled) setEnv('injected');
        return;
      }

      // Todavía sin provider: reintentar hasta ~1.5s antes de dar 'none'
      tries += 1;
      if (tries >= 10) {
        setEnv('none');
        return;
      }
      setTimeout(detect, 150);
    };

    detect();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const runAuthFlow = useCallback(async (userInitiated = false) => {
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
        throw new Error('No se encontró una billetera. Abrí esta app en MiniPay.');
      }

      // ✅ leer isMiniPay directo del provider (evita race condition del primer render)
      const currentIsMiniPay = !!(provider as any)?.isMiniPay;

      let address: string;
      try {
        const accounts: string[] = await provider.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          address = accounts[0]!;
        } else {
          // Sin cuenta autorizada → requestAddresses ABRE el popup de la wallet.
          // Afuera de MiniPay eso exige un gesto del usuario: si el flujo se
          // disparó solo (no userInitiated), volvemos a idle y mostramos el
          // botón "Conectar billetera" en vez de intentar un popup que la
          // wallet bloquearía por falta de gesto.
          if (!currentIsMiniPay && !userInitiated) {
            guard.current.attempted = false;
            setStep('idle');
            return;
          }
          const walletClient = createWalletClient({ transport: custom(provider) });
          const requested: string[] = await walletClient.requestAddresses();
          if (!requested.length) throw new Error('No se obtuvo acceso a la billetera.');
          address = requested[0]!;
        }
      } catch (walletErr: any) {
        throw new Error(walletErr?.message || 'No se pudo conectar la billetera.');
      }

      connectWallet(address);
      guard.current.lastAddress = address;

      // ── Bifurcar por tipo de wallet ─────────────────────────────────────
      // MiniPay nunca firma. Si SIWE_DISABLED, MetaMask tampoco → ambos van por
      // el login por address (/api/auth/minipay).
      if (currentIsMiniPay || SIWE_DISABLED) {
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

    // Esperar a que termine la detección del entorno de wallet
    if (env === 'detecting') return;

    const hasSession = !!state.authToken;

    // Sin wallet y sin sesión previa → no hay nada que auto-ejecutar.
    // La UI muestra la pantalla "instalá una wallet".
    if (env === 'none' && !hasSession) return;

    // Solo auto-conectar sin gesto cuando es seguro:
    //  - dentro de MiniPay (conexión implícita), o
    //  - la wallet ya autorizó una cuenta (no hay popup), o
    //  - hay una sesión guardada por validar (no toca la wallet).
    // Afuera de MiniPay sin cuenta autorizada → esperamos el click del botón.
    const canAuto = env === 'minipay' || preAuthorized || hasSession;
    if (!canAuto) return;

    if (guard.current.attempted) {
      const currentAddr = state.walletAddress || walletAddress;
      if (!currentAddr || currentAddr.toLowerCase() === guard.current.lastAddress?.toLowerCase()) return;
      guard.current.attempted = false;
      guard.current.lastAddress = currentAddr;
    }

    runAuthFlow();
  }, [env, preAuthorized, step, state.walletAddress, walletAddress, runAuthFlow, isAuthLoading, state.authToken]);

  const retry = useCallback(() => {
    guard.current.attempted = false;
    guard.current.lastAddress = null;
    setStep('idle');
    setError(null);
  }, []);

  // Disparo manual por gesto del usuario (botón "Conectar billetera").
  // userInitiated=true → SÍ puede abrir el popup de la wallet.
  const connect = useCallback(() => {
    guard.current.attempted = false;
    guard.current.lastAddress = null;
    setError(null);
    runAuthFlow(true);
  }, [runAuthFlow]);

  const isMiniPayNow = typeof window !== 'undefined' && !!(window as any).ethereum?.isMiniPay;
  const connectorType = isMiniPayNow ? 'MiniPay' : isAvailable ? 'MetaMask' : 'No disponible';

  // Afuera de MiniPay, con wallet presente pero sin cuenta autorizada aún:
  // la UI debe mostrar el botón "Conectar billetera" (no auto-conectamos).
  const needsManualConnect =
    env === 'injected' && !preAuthorized && !isAuthLoading && !isAuthenticated;

  return {
    step,
    error,
    isAuthenticated,
    isAuthLoading,
    retry,
    connect,
    connectorType,
    env,
    needsManualConnect,
    address: walletAddress || state.walletAddress,
  };
}
