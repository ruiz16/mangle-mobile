import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAppState } from '../context/AppState';
import { useMiniPay } from '../hooks/useMiniPay';
import { showToast } from '../components/Toast';
import { formatCopmBalance } from '../lib/currency';

export default function Connect() {
  const { connectWallet } = useAppState();
  const [, navigate] = useLocation();
  const { isMiniPay, isAvailable, connect, isConnecting, error } = useMiniPay();

  const [localError, setLocalError] = useState<string | null>(null);
  const [copmDisplay, setCopmDisplay] = useState<string | null>(null);

  // Auto-connect when MiniPay is detected
  useEffect(() => {
    if (isMiniPay) {
      handleConnect();
    }
    // Only run once on mount when MiniPay is detected
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMiniPay]);

  const handleConnect = async () => {
    setLocalError(null);
    try {
      const result = await connect();

      // Update AppState with real data
      const display = formatCopmBalance(result.copmBalance);
      connectWallet(result.address, display);
      setCopmDisplay(display);

      showToast(
        'Billetera Conectada',
        `Conexión exitosa con ${isMiniPay ? 'MiniPay' : 'MetaMask'}.`,
        'success',
      );

      setTimeout(() => navigate('/register'), 1000);
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Error al conectar la wallet.';
      setLocalError(msg);
    }
  };

  // ----- RENDER: No wallet available -----
  if (!isAvailable && !isConnecting) {
    return (
      <div className="flex-1 flex flex-col justify-between p-6">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-2xl shadow-sm">
            <i className="fa-solid fa-triangle-exclamation" />
          </div>
          <h3 className="text-lg font-bold text-[#1E3E28]">Wallet no detectada</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Para usar MANGLE necesitás una wallet como{' '}
            <strong>MetaMask</strong> (escritorio) o{' '}
            <strong>MiniPay</strong> (celular).
          </p>

          <div className="space-y-2">
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 bg-[#2A5C3C] hover:bg-[#1E3E28] text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              <i className="fa-brands fa-chrome mr-2" /> Descargar MetaMask
            </a>
            <a
              href="https://www.opera.com/minipay"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 border border-[#2A5C3C] text-[#2A5C3C] font-bold text-xs rounded-xl hover:bg-[#EBF4EE] transition"
            >
              <i className="fa-solid fa-mobile-screen mr-2" /> Descargar MiniPay
            </a>
          </div>
        </div>

        <button
          onClick={() => navigate('/')}
          className="w-full py-2.5 text-slate-400 hover:text-slate-600 text-xs font-semibold"
        >
          Volver
        </button>
      </div>
    );
  }

  // ----- RENDER: Error state -----
  const displayError = localError || error;

  // ----- RENDER: Main connect screen -----
  return (
    <div className="flex-1 flex flex-col justify-between p-6">
      <div className="space-y-4 text-center">
        <div className="w-16 h-16 bg-[#EBF4EE] text-[#2A5C3C] rounded-full flex items-center justify-center mx-auto text-2xl shadow-sm">
          {isConnecting ? (
            <div className="w-6 h-6 border-2 border-[#2A5C3C]/30 border-t-[#2A5C3C] rounded-full animate-spin" />
          ) : (
            <i className="fa-solid fa-wallet" />
          )}
        </div>

        <h3 className="text-lg font-bold text-[#1E3E28]">
          {isMiniPay ? 'Conectando con MiniPay...' : 'Conectar Wallet'}
        </h3>

        {!isMiniPay && (
          <p className="text-xs text-slate-500 leading-relaxed">
            MANGLE solicita permiso para conectarse a tu wallet{' '}
            <strong>Celo (Celo)</strong> y leer tu balance de{' '}
            <strong>COPm</strong> para gestionar tus microcréditos.
          </p>
        )}

        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 text-left space-y-2.5">
          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
            Información Compartida
          </span>
          <div className="flex items-center gap-2 text-xs">
            <i className="fa-solid fa-check text-emerald-600" />
            <span>Dirección pública (Wallet Address)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <i className="fa-solid fa-check text-emerald-600" />
            <span>Consultas de balance de COPm</span>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
            <span>Red activa:</span>
            <span className="bg-slate-50 px-2 py-0.5 rounded text-slate-600">
              {import.meta.env.VITE_CELO_NETWORK === 'mainnet' ? 'Celo Mainnet' : 'Celo Sepolia'}
            </span>
          </div>
        </div>

        {/* Error message */}
        {displayError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[11px] text-red-800 text-left flex items-start gap-2">
            <i className="fa-solid fa-circle-exclamation mt-0.5" />
            <span>{displayError}</span>
          </div>
        )}

        {/* COPm balance after successful connection */}
        {copmDisplay && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-800 text-left flex items-center gap-2">
            <i className="fa-solid fa-coins" />
            <span>Balance COPm: <strong>{copmDisplay}</strong></span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {/* If not MiniPay, show connect button */}
        {!isMiniPay && (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full py-3 bg-[#2A5C3C] hover:bg-[#1E3E28] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            {isConnecting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <i className="fa-solid fa-link" /> Autorizar y Conectar Wallet
              </>
            )}
          </button>
        )}

        {/* Retry if error */}
        {displayError && (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full py-2.5 border border-slate-200 text-slate-600 hover:text-slate-800 text-xs font-semibold rounded-xl transition"
          >
            <i className="fa-solid fa-rotate mr-1" /> Intentar de nuevo
          </button>
        )}

        <button
          onClick={() => navigate('/')}
          className="w-full py-2.5 text-slate-400 hover:text-slate-600 text-xs font-semibold"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
