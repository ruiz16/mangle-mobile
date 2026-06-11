// =============================================================================
// Connect — Wallet connection + SIWE auth UI
// =============================================================================
//
// This page is a THIN UI layer over the useAuth() hook.
// The actual auth orchestration lives in hooks/useAuth.ts — this component
// only renders the appropriate UI for each auth step and handles post-auth
// profile data fetching (participantes/me + gacc/mi-grupo).
// =============================================================================

import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import Lottie from 'lottie-react';
import { useAppState } from '../context/AppState';
import { useAuth } from '../hooks/useAuth';
import { showToast } from '../components/Toast';
import { apiGet } from '../lib/api';
import type { AuthStep } from '../types';
import connectAnimation from '../assets/lottie/16a8e6c0-117a-11ee-a9de-ab7b4c8f4c79.json';

// =============================================================================
// Step → Human-readable label
// =============================================================================

const STEP_LABELS: Record<AuthStep, string> = {
  idle: 'Preparando, un momento.',
  checking_session: 'Verificando sesión anterior',
  connecting_wallet: 'Conectando con MiniPay',
  fetching_nonce: 'Preparando autenticación',
  signing: 'Firmá el mensaje en tu wallet',
  exchanging: 'Autenticando con el servidor',
  authenticated: 'Autenticado con éxito!',
  error: 'Error de conexión',
};

// =============================================================================
// Component
// =============================================================================

export default function Connect() {
  const {
    state,
    refreshTokens,
    setFullName,
    setRole,
    setPhone,
    setMunicipio,
    setGaccCode,
    setGaccName,
    setGaccMembers,
  } = useAppState();

  const {
    step,
    error: authError,
    isAuthenticated,
    retry,
    connectorType,
  } = useAuth();

  const [, navigate] = useLocation();

  // Prevent duplicate profile fetches (React StrictMode double-mount)
  const profileFetched = useRef(false);

  // ── Post-auth: navigate to next screen ──────────────────────────────
  //
  // SEPARATE from profile fetch below so that StrictMode double-mount
  // (dev) doesn't block navigation. The navigation effect has NO ref guard.
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !state.authToken) return;

    const timer = setTimeout(() => {
      navigate(state.registered ? '/education' : '/register');
    }, 500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, state.authToken, state.registered, navigate]);

  // ── Post-auth: hydrate global state from server (existing user) ─────
  //
  // Uses a ref guard to prevent double-fetch in React StrictMode (dev).
  // This is intentionally SEPARATE from navigation so the ref doesn't
  // block the redirect.
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !state.authToken || !state.registered || profileFetched.current) return;

    profileFetched.current = true;

    (async () => {
      try {
        const [meData, gaccData] = await Promise.all([
          apiGet<{ participante: { nombre: string; rol: string; telefono: string } }>(
            '/api/participantes/me',
            { token: state.authToken, refreshToken: state.refreshToken, onTokenRefresh: refreshTokens },
          ),
          apiGet<{
            grupo: { id: number; nombre: string; codigo: string; municipio: string } | null;
            miembro: { id: number } | null;
            miembros: Array<{
              id: number;
              participante_id: number;
              validado_en: string | null;
              participante: { nombre: string; score_reputacion: number } | null;
            }>;
          }>('/api/gacc/mi-grupo', { token: state.authToken, refreshToken: state.refreshToken, onTokenRefresh: refreshTokens }),
        ]);

        if (meData?.participante) {
          setFullName(meData.participante.nombre);
          setRole(meData.participante.rol);
          setPhone(meData.participante.telefono);
        }

        if (gaccData?.grupo) {
          setGaccCode(gaccData.grupo.codigo);
          setGaccName(gaccData.grupo.nombre);
          if (gaccData.grupo.municipio) setMunicipio(gaccData.grupo.municipio as 'guapi' | 'timbiqui');

          if (gaccData.miembros) {
            const selfId = gaccData.miembro?.id ?? 0;
            const members = gaccData.miembros.map((m) => ({
              id: String(m.id),
              participanteId: String(m.participante_id),
              name: m.participante?.nombre ?? '',
              role: '',
              status: (m.validado_en ? 'Al día' : 'En Alerta') as 'Al día' | 'En Alerta',
              score: m.participante?.score_reputacion ?? 50,
              validado: !!m.validado_en,
              self: m.id === selfId,
            }));
            setGaccMembers(members);
          }
        }
      } catch (err) {
        console.warn('[Connect] No se pudieron cargar datos del perfil/GACC:', err);
        // Non-fatal — fallback to local state
      }
    })();
  }, [isAuthenticated, state.authToken, state.registered]);

  // ── Toast on auth success ────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) {
      showToast(
        'Wallet Autenticada',
        `Conexión exitosa con ${connectorType}.`,
        'success',
      );
    }
  }, [isAuthenticated, connectorType]);

  // ==========================================================================
  // Shared: Card backdrop + Lottie renderer
  // ==========================================================================

  function LottieDisplay({ size = 180 }: { size?: number }) {
    return (
      <div className="mx-auto flex items-center justify-center">
        <Lottie
          animationData={connectAnimation}
          loop
          autoplay
          style={{ width: size, height: size }}
        />
      </div>
    );
  }

  function CancelButton() {
    return (
      <button
        onClick={() => navigate('/')}
        className="w-full py-3 text-slate-400 rounded-full border border-slate-400 hover:text-[#1E3E28] text-xs font-semibold transition-colors"
      >
        Cancelar
      </button>
    );
  }

  // ==========================================================================
  // RENDER: No wallet detected
  // ==========================================================================

  if (step === 'connecting_wallet' && authError?.includes('No se encontró una wallet')) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-[#F0F7F3] to-[#E8F0EC] p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-green-900/5 p-8 space-y-6">
          {/* Lottie */}
          <LottieDisplay size={160} />

          {/* Text */}
          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold text-[#1E3E28]">Wallet no detectada</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Para usar MANGLE necesitás una wallet como{' '}
              <strong className="text-[#2A5C3C]">MetaMask</strong> (escritorio) o{' '}
              <strong className="text-[#2A5C3C]">MiniPay</strong> (celular).
            </p>
          </div>

          {/* Download buttons */}
          <div className="space-y-3">
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full py-3.5 bg-[#1E3E28] hover:bg-[#2A5C3C] text-white font-bold text-sm rounded-2xl shadow-md shadow-green-900/10 transition-all active:scale-[0.98]"
            >
              <i className="fa-brands fa-chrome text-base" />
              Descargar MetaMask
            </a>
            <a
              href="https://www.opera.com/minipay"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full py-3.5 border-2 border-[#2A5C3C] text-[#2A5C3C] font-bold text-sm rounded-2xl hover:bg-[#EBF4EE] transition-all active:scale-[0.98]"
            >
              <i className="fa-solid fa-mobile-screen text-base" />
              Descargar MiniPay
            </a>
          </div>

          {/* Back */}
          <button
            onClick={() => navigate('/')}
            className="w-full py-2 text-slate-400 hover:text-[#1E3E28] text-xs font-semibold transition-colors"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // RENDER: Auth error — show retry
  // ==========================================================================

  if (step === 'error' || (step === 'connecting_wallet' && authError)) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-[#F0F7F3] to-[#E8F0EC] p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-green-900/5 p-8 space-y-6">
          {/* Lottie */}
          <LottieDisplay size={160} />

          {/* Text */}
          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold text-[#1E3E28]">Error de conexión</h1>
            <p className="text-sm text-slate-500 leading-relaxed">{authError}</p>
          </div>

          {/* Retry */}
          <button
            onClick={retry}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#1E3E28] hover:bg-[#2A5C3C] text-white font-bold text-sm rounded-2xl shadow-md shadow-green-900/10 transition-all active:scale-[0.98]"
          >
            <i className="fa-solid fa-rotate text-sm" />
            Reintentar
          </button>

          <CancelButton />
        </div>
      </div>
    );
  }

  // ==========================================================================
  // RENDER: Auth in progress (Lottie + step label)
  // ==========================================================================

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-[#F0F7F3] to-[#E8F0EC] p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-green-900/5 p-8 space-y-6">
        {/* Lottie — the main visual */}
        <LottieDisplay size={180} />

        {/* Step label + description */}
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-[#1E3E28]">
            {STEP_LABELS[step]}
          </h1>

          {step === 'signing' && (
            <p className="text-sm text-slate-500 leading-relaxed">
              Revisá tu wallet <strong className="text-[#2A5C3C]">{connectorType}</strong> y firmá el mensaje para autenticarte.
            </p>
          )}

          {step === 'checking_session' && (
            <p className="text-sm text-slate-400">Buscando una sesión anterior</p>
          )}
        </div>

        {/* Network badge */}
        <div className="flex justify-center">
          <span className="bg-[#F0F7F3] border border-[#2A5C3C]/10 px-4 py-1.5 rounded-full text-[11px] font-mono text-[#2A5C3C] font-medium tracking-wider">
            {import.meta.env.VITE_CELO_NETWORK === 'mainnet' ? 'Network: Celo Mainnet' : 'Network: Celo Sepolia'}
          </span>
        </div>
        <CancelButton />
      </div>
    </div>
  );
}
