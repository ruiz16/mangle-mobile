// =============================================================================
// useAuth — Auth state machine orchestrator for MANGLE
// =============================================================================
//
// Orchestrates the complete authentication flow:
//   1. checking_session    — validate stored JWT via /api/participantes/me
//   2. connecting_wallet   — eth_accounts (silent) → eth_requestAccounts
//   3. fetching_nonce      — GET /api/auth/nonce (MetaMask only)
//   4. signing             — personal_sign (MetaMask only)
//   5. exchanging          — POST /api/auth/minipay OR /api/auth/siwe → JWT
//   6. authenticated ✅
//
// Guards against infinite re-triggering:
//   - `guard.attempted` ref blocks re-entry after first attempt
//   - Wallet address change resets the guard (account switch)
//   - `retry()` must be called explicitly to reset from error state
//   - In-progress steps (connecting_wallet..exchanging) suppress re-runs
//
// FIX (race condition MiniPay):
//   isMiniPay se lee DIRECTO del provider dentro de runAuthFlow, no desde
//   el closure del useCallback. En el primer render, window.ethereum puede
//   no tener aún isMiniPay=true aunque estemos dentro de MiniPay WebView,
//   lo que hacía que el flow fuera al path SIWE (personal_sign) que MiniPay
//   no soporta. Al leerlo en el momento de ejecutar el flow, siempre tenemos
//   el valor correcto.
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { createWalletClient, custom } from 'viem';
import { useMiniPay } from './useMiniPay';
import { useAppState } from '../context/AppState';
import { createSiweMessage } from '../lib/siwe';
import { getActiveChain } from '../lib/network';
import { apiGet, apiPost, ApiRequestError } from '../lib/api';
import type { AuthStep } from '../types';

// =============================================================================
// Hook
// =============================================================================

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

  // ── Local state (avoids stale closure issues with global state) ──────────
  const [step, setStep] = useState<AuthStep>(state.authStep);
  const [error, setError] = useState<string | null>(null);

  // ── Infinite-loop guard ───────────────────────────────────────────────────
  //
  //  attempted   = true after the FIRST full auth attempt (success or fail).
  //                Reset to false only when:
  //                  - wallet address changes (account switch)
  //                  - retry() is called explicitly
  //  lastAddress  = the address that was used in the last attempt.
  //                 If the wallet address changes, we know to re-authenticate.
  //  isRunning    = true while the async flow is actively executing, preventing
  //                 concurrent executions before state updates.
  // ──────────────────────────────────────────────────────────────────────────
  const guard = useRef({ attempted: false, lastAddress: null as string | null, isRunning: false });

  // ── Derived flags ─────────────────────────────────────────────────────────
  const isAuthenticated = step === 'authenticated';
  const isAuthLoading =
    step === 'checking_session' ||
    step === 'connecting_wallet' ||
    step === 'fetching_nonce' ||
    step === 'signing' ||
    step === 'exchanging';

  // ── Sync local step → global AppState (for other components) ─────────────
  useEffect(() => {
    if (step !== state.authStep) {
      setAuthStep(step);
    }
    // Only react to local step changes, not global state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Detect wallet account switch while authenticated ─────────────────────
  //
  // If the user switches accounts in MiniPay while already logged in, we
  // need to reset auth so they can re-authenticate with the new address.
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (step === 'authenticated' && walletAddress && guard.current.lastAddress !== walletAddress) {
      clearAuth();
      guard.current.attempted = false;
      guard.current.lastAddress = walletAddress;
      setStep('idle');
      setError(null);
    }
  }, [walletAddress, step, clearAuth]);

  // ── Core auth flow ────────────────────────────────────────────────────────
  //
  // Executed ONCE on mount (and again if guard resets). Every setStep() call
  // triggers the main effect below, but the guard prevents re-entry.
  //
  // IMPORTANTE: isMiniPay se lee DIRECTO del provider aquí dentro, no desde
  // el closure. Esto evita el race condition donde el primer render no tiene
  // aún window.ethereum.isMiniPay=true inyectado por el WebView de MiniPay.
  // ────────────────────────────────────────────────────────────────────────────
  const runAuthFlow = useCallback(async () => {
    if (guard.current.isRunning) return;

    // 🔒 LOCK: prevent any re-entry until retry() is called
    guard.current.attempted = true;
    guard.current.isRunning = true;

    try {
      // ── Step 1: Validate stored session ──────────────────────────
      setStep('checking_session');
      setError(null);

      const savedToken = state.authToken;
      if (savedToken) {
        try {
          // Ping a protected endpoint — if it returns 200, session is valid.
          // Pass refreshToken so an expired access_token is silently renewed
          // instead of triggering a full SIWE re-auth.
          await apiGet('/api/participantes/me', {
            token: savedToken,
            refreshToken: state.refreshToken,
            onTokenRefresh: refreshTokens,
          });
          setStep('authenticated');
          return; // ✅ Already authenticated — nothing more to do
        } catch (err) {
          if (err instanceof ApiRequestError && err.status === 401) {
            // Token expired or revoked — clear and re-authenticate
            clearAuth();
            // guard.attempted stays true; the effect won't re-trigger.
            // Execution continues below inside the same async context.
          } else if (err instanceof ApiRequestError && err.status === 404) {
            // Token is valid, but user hasn't completed onboarding yet.
            // Don't clear the token — the Register page needs it.
            setStep('authenticated');
            return;
          } else {
            // Network error or server error (5xx) — don't clear a valid token.
            // Show error and let the user retry.
            const msg =
              (err as any)?.message || 'No se pudo verificar la sesión. Verificá tu conexión.';
            setError(msg);
            setStep('error');
            guard.current.attempted = false; // Allow retry
            return; // Stop the flow — don't attempt full SIWE
          }
        }
      }

      // ── Step 2: Auto-connect wallet ──────────────────────────────
      setStep('connecting_wallet');

      const provider =
        typeof window !== 'undefined' ? (window as unknown as { ethereum?: any }).ethereum : null;

      if (!provider) {
        throw new Error('No se encontró una wallet. Abrí esta app en MiniPay.');
      }

      // ✅ FIX: leer isMiniPay directo del provider en este momento,
      // no desde el closure del useCallback (puede ser stale en el primer render).
      const currentIsMiniPay = !!(provider as any)?.isMiniPay;

      let address: string;
      try {
        // Try silent eth_accounts first (never prompts the user)
        const accounts: string[] = await provider.request({ method: 'eth_accounts' });

        if (accounts.length > 0) {
          address = accounts[0]!;
        } else {
          // Silent check returned nothing — request access (may show prompt)
          const walletClient = createWalletClient({ transport: custom(provider) });
          const requested: string[] = await walletClient.requestAddresses();
          if (!requested.length) throw new Error('No se obtuvo acceso a la wallet.');
          address = requested[0]!;
        }
      } catch (walletErr: any) {
        throw new Error(walletErr?.message || 'No se pudo conectar la wallet.');
      }

      // Store address in global state
      connectWallet(address);
      guard.current.lastAddress = address;

      // ── Step 3+: Bifurcate by connector ──────────────────────────
      //
      // MiniPay does not support personal_sign — skip nonce+signing
      // and go directly to the address-only exchange endpoint.
      // MetaMask uses the full SIWE flow.
      // ─────────────────────────────────────────────────────────────

      if (currentIsMiniPay) {
        // ── MiniPay path: address-only auth ─────────────────────────
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
        // ── MetaMask path: full SIWE flow ────────────────────────────

        // Step 3: Fetch server-validated nonce
        setStep('fetching_nonce');
        const chainId = getActiveChain().id;

        const nonceResult = await apiGet<{ nonce: string }>(
          `/api/auth/nonce?wallet_address=${address}`,
        );

        // Step 4: Sign SIWE message (EIP-4361)
        setStep('signing');

        const siweMessage = createSiweMessage({
          address: address as `0x${string}`,
          chainId,
          nonce: nonceResult.nonce,
        });

        const signature = await signMessage(siweMessage, address as `0x${string}`);
        setSiweAuth(siweMessage, signature);

        // Step 5: Exchange signature for Supabase session tokens
        setStep('exchanging');

        const authResult = await apiPost<{
          ok: boolean;
          isNewUser: boolean;
          profile_completed: boolean;
          access_token: string;
          refresh_token: string;
        }>('/api/auth/siwe', { message: siweMessage, signature });

        console.log('[useAuth] isNewUser:', authResult.isNewUser, 'profile_completed:', authResult.profile_completed);

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
      // guard.attempted stays true — effect won't re-trigger on its own
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
    // ✅ isMiniPay eliminado de las dependencias — se lee directo del provider
    //    dentro del flow para evitar el race condition del primer render.
  ]);

  // ── Main trigger effect ───────────────────────────────────────────────────
  //
  // Dependencies:
  //   - step               : re-evaluate when state changes
  //   - state.walletAddress: re-evaluate when global wallet changes
  //   - walletAddress      : re-evaluate when useMiniPay detects address
  //   - runAuthFlow        : stable callback
  //   - isAuthLoading      : derived from step
  //
  // This effect has FOUR guards that prevent infinite loops:
  //   1. Already authenticated → skip
  //   2. Already mid-flow (connecting..exchanging) → skip
  //   3. window.ethereum not yet available → skip (wait for next render)
  //   4. Already attempted, and address hasn't changed → skip
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // 🛡️ GUARD 1: Already authenticated
    if (step === 'authenticated') return;

    // 🛡️ GUARD 2: Already in the middle of an auth step
    if (isAuthLoading) return;

    // 🛡️ GUARD 3: window.ethereum not yet injected (MiniPay WebView timing)
    // MiniPay inyecta window.ethereum de forma asíncrona al cargar el WebView.
    // Si no está disponible aún, esperamos al próximo render en lugar de lanzar
    // el flow por el path SIWE incorrectamente.
    const providerReady =
      typeof window !== 'undefined' && !!(window as any).ethereum;
    if (!providerReady) return;

    // 🛡️ GUARD 4: Already attempted full auth, address hasn't changed
    if (guard.current.attempted) {
      const currentAddr = state.walletAddress || walletAddress;
      if (!currentAddr || currentAddr.toLowerCase() === guard.current.lastAddress?.toLowerCase()) return;
      // Address changed → allow re-authentication
      guard.current.attempted = false;
      guard.current.lastAddress = currentAddr;
    }

    runAuthFlow();
  }, [step, state.walletAddress, walletAddress, runAuthFlow, isAuthLoading]);

  // ── Manual retry (for error recovery) ─────────────────────────────────────
  const retry = useCallback(() => {
    guard.current.attempted = false;
    guard.current.lastAddress = null;
    setStep('idle');
    setError(null);
  }, []);

  // ── Debug helpers ─────────────────────────────────────────────────────────
  // isMiniPay se lee directo del provider para consistencia con runAuthFlow
  const isMiniPayNow = typeof window !== 'undefined' && !!(window as any).ethereum?.isMiniPay;
  const connectorType = isMiniPayNow ? 'MiniPay' : isAvailable ? 'MetaMask' : 'No disponible';

  // =========================================================================
  // Return
  // =========================================================================

  return {
    /** Current auth step (for UI rendering) */
    step,
    /** Human-readable error, null if no error */
    error,
    /** True when auth is complete */
    isAuthenticated,
    /** True while any pre-auth step is in progress (show loading) */
    isAuthLoading,
    /** Call to recover from error state */
    retry,
    /** Which wallet type was detected */
    connectorType,
    /** Connected wallet address, if any */
    address: walletAddress || state.walletAddress,
  };
}
