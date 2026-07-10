// =============================================================================
// Connect — Wallet connection + SIWE auth UI
// =============================================================================

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import Lottie from 'lottie-react';
import { useAppState } from '../context/AppState';
import { useAuth } from '../hooks/useAuth';
import { showToast } from '../components/Toast';
import type { AuthStep } from '../types';
import connectAnimation from '../assets/lottie/16a8e6c0-117a-11ee-a9de-ab7b4c8f4c79.json';

const STEP_LABELS: Record<AuthStep, string> = {
  idle: 'Preparando, un momento.',
  checking_session: 'Verificando sesión anterior',
  connecting_wallet: 'Conectando tu billetera',
  fetching_nonce: 'Preparando autenticación',
  signing: 'Firmá el mensaje en tu billetera',
  exchanging: 'Autenticando con el servidor',
  authenticated: 'Autenticado con éxito!',
  error: 'Error de conexión',
};

export default function Connect() {
  const { state } = useAppState();

  const {
    step,
    error: authError,
    isAuthenticated,
    retry,
    connect,
    connectorType,
    isMiniPay,
    needsManualConnect,
  } = useAuth();

  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthenticated || !state.authToken) return;
    const timer = setTimeout(() => {
      navigate(state.registered ? '/repayment' : '/register');
    }, 500);
    return () => clearTimeout(timer);
  }, [isAuthenticated, state.authToken, state.registered, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      showToast('Billetera conectada', `Conexión exitosa con ${connectorType}.`, 'success');
    }
  }, [isAuthenticated, connectorType]);

  function LottieDisplay({ size = 180 }: { size?: number }) {
    return (
      <div className="mx-auto flex items-center justify-center">
        <Lottie animationData={connectAnimation} loop autoplay style={{ width: size, height: size }} />
      </div>
    );
  }

  function CancelButton() {
    if (isMiniPay) return null;
    return (
      <button
        onClick={() => navigate('/')}
        className="w-full py-3 text-slate-400 rounded-full border border-slate-400 hover:text-ink text-xs font-semibold transition-colors"
      >
        Cancelar
      </button>
    );
  }

  if (step === 'error' || (step === 'connecting_wallet' && authError)) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-surface-light to-surface p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-ink/5 p-8 space-y-6">
          <LottieDisplay size={160} />
          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold text-ink">Error de conexión</h1>
            <p className="text-sm text-slate-500 leading-relaxed">{authError}</p>
          </div>
          <button onClick={retry} className="flex items-center justify-center gap-2 w-full py-3.5 bg-ink hover:bg-primary text-white font-bold text-sm rounded-2xl shadow-md shadow-ink/10 transition-all active:scale-[0.98]">
            <i className="fa-solid fa-rotate text-sm" /> Reintentar
          </button>
          <CancelButton />
        </div>
      </div>
    );
  }

  // Fuera de MiniPay y sin conexión: botón que abre el modal de RainbowKit.
  // Dentro de MiniPay no aparece (conexión implícita, auto-connect).
  if (needsManualConnect) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-surface-light to-surface p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-ink/5 p-8 space-y-6">
          <LottieDisplay size={160} />
          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold text-ink">Conectá tu billetera</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Elegí tu billetera para entrar a MANGLE.
            </p>
          </div>
          <button
            onClick={connect}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-ink hover:bg-primary text-white font-bold text-sm rounded-2xl shadow-md shadow-ink/10 transition-all active:scale-[0.98]"
          >
            <i className="fa-solid fa-wallet text-sm" /> Conectar billetera
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-2 text-slate-400 hover:text-ink text-xs font-semibold transition-colors"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-surface-light to-surface p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-ink/5 p-8 space-y-6">
        <LottieDisplay size={180} />
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-ink">{STEP_LABELS[step]}</h1>
          {step === 'signing' && (
            <p className="text-sm text-slate-500 leading-relaxed">Revisá tu billetera y firmá el mensaje para autenticarte.</p>
          )}
          {step === 'checking_session' && (
            <p className="text-sm text-slate-400">Buscando una sesión anterior</p>
          )}
        </div>
        <CancelButton />
      </div>
    </div>
  );
}
