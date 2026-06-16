// =============================================================================
// Connect — Wallet connection + SIWE auth UI
// DEBUG VERSION: panel visible para diagnosticar en MiniPay
// =============================================================================

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import Lottie from 'lottie-react';
import { useAppState } from '../context/AppState';
import { useAuth } from '../hooks/useAuth';
import { showToast } from '../components/Toast';
import { mangleStorage } from '../lib/storage';
import type { AuthStep } from '../types';
import connectAnimation from '../assets/lottie/16a8e6c0-117a-11ee-a9de-ab7b4c8f4c79.json';

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
// DEBUG panel — visible directamente en pantalla en MiniPay
// =============================================================================
function DebugPanel({ step, error }: { step: AuthStep; error: string | null }) {
  const [info, setInfo] = useState<Record<string, unknown>>({});

  useEffect(() => {
    const provider = (window as any).ethereum;
    const stored = mangleStorage.getItem('mangle:state');
    let parsed: any = null;
    try { parsed = stored ? JSON.parse(stored) : null; } catch { /* noop */ }

    setInfo({
      step,
      error: error ?? 'ninguno',
      isMiniPay: !!provider?.isMiniPay,
      providerExists: !!provider,
      hasStoredToken: !!parsed?.authToken,
      hasStoredRefresh: !!parsed?.refreshToken,
      storedStep: parsed?.authStep ?? 'none',
      apiUrl: import.meta.env.VITE_API_URL ?? 'NO DEFINIDA',
      network: import.meta.env.VITE_CELO_NETWORK ?? 'NO DEFINIDA',
    });
  }, [step, error]);

  return (
    <div className="mt-4 p-3 bg-slate-900 rounded-xl text-left">
      <p className="text-[9px] font-bold text-yellow-400 mb-2 uppercase tracking-wider">DEBUG — eliminar antes del demo</p>
      {Object.entries(info).map(([k, v]) => (
        <div key={k} className="flex gap-2 text-[9px] font-mono mb-0.5">
          <span className="text-slate-400 min-w-[110px]">{k}:</span>
          <span className={`${
            v === true ? 'text-green-400' :
            v === false ? 'text-red-400' :
            v === 'ninguno' ? 'text-slate-500' :
            'text-white'
          }`}>{String(v)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Connect() {
  const { state } = useAppState();

  const {
    step,
    error: authError,
    isAuthenticated,
    retry,
    connectorType,
  } = useAuth();

  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthenticated || !state.authToken) return;
    const timer = setTimeout(() => {
      navigate(state.registered ? '/education' : '/register');
    }, 500);
    return () => clearTimeout(timer);
  }, [isAuthenticated, state.authToken, state.registered, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      showToast('Wallet Autenticada', `Conexión exitosa con ${connectorType}.`, 'success');
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
    return (
      <button
        onClick={() => navigate('/')}
        className="w-full py-3 text-slate-400 rounded-full border border-slate-400 hover:text-ink text-xs font-semibold transition-colors"
      >
        Cancelar
      </button>
    );
  }

  if (step === 'connecting_wallet' && authError?.includes('No se encontró una wallet')) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-surface-light to-surface p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-ink/5 p-8 space-y-6">
          <LottieDisplay size={160} />
          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold text-ink">Wallet no detectada</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Para usar MANGLE necesitás una wallet como{' '}
              <strong className="text-primary">MetaMask</strong> o{' '}
              <strong className="text-primary">MiniPay</strong>.
            </p>
          </div>
          <DebugPanel step={step} error={authError} />
          <button onClick={() => navigate('/')} className="w-full py-2 text-slate-400 hover:text-ink text-xs font-semibold transition-colors">Volver</button>
        </div>
      </div>
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
          <DebugPanel step={step} error={authError} />
          <button onClick={retry} className="flex items-center justify-center gap-2 w-full py-3.5 bg-ink hover:bg-primary text-white font-bold text-sm rounded-2xl shadow-md shadow-ink/10 transition-all active:scale-[0.98]">
            <i className="fa-solid fa-rotate text-sm" /> Reintentar
          </button>
          <CancelButton />
        </div>
      </div>
    );
  }

  // Loading / progress
  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-surface-light to-surface p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-ink/5 p-8 space-y-6">
        <LottieDisplay size={180} />
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-ink">{STEP_LABELS[step]}</h1>
          {step === 'signing' && (
            <p className="text-sm text-slate-500 leading-relaxed">Revisá tu wallet y firmá el mensaje para autenticarte.</p>
          )}
          {step === 'checking_session' && (
            <p className="text-sm text-slate-400">Buscando una sesión anterior</p>
          )}
        </div>
        <div className="flex justify-center">
          <span className="bg-surface-light border border-primary/10 px-4 py-1.5 rounded-full text-[11px] font-mono text-primary font-medium tracking-wider">
            {import.meta.env.VITE_CELO_NETWORK === 'mainnet' ? 'Network: Celo Mainnet' : 'Network: Celo Sepolia'}
          </span>
        </div>
        <DebugPanel step={step} error={authError} />
        <CancelButton />
      </div>
    </div>
  );
}
