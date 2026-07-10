// =============================================================================
// PruebaWallet — Página de prueba de conexión (usa los providers GLOBALES).
// Descartable: borrar este archivo + su <Route> en App.tsx cuando no la necesites.
// =============================================================================

import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function PruebaWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firmando, setFirmando] = useState(false);

  async function firmar() {
    setError(null);
    setFirmando(true);
    try {
      const sig = await signMessageAsync({ message: `Prueba MANGLE — ${new Date().toISOString()}` });
      setSignature(sig);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Error al firmar');
    } finally {
      setFirmando(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-surface-light to-surface p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-ink/5 p-8 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-ink">Prueba WalletConnect</h1>
          <p className="text-xs text-slate-400">/prueba-wallet</p>
        </div>

        <div className="flex justify-center">
          <ConnectButton />
        </div>

        {isConnected && address && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Conectado ✅</p>
              <p className="text-sm font-mono text-ink break-all">{address}</p>
              {chainId != null && <p className="text-xs text-slate-500">Chain ID: <strong>{chainId}</strong></p>}
            </div>

            <button
              onClick={firmar}
              disabled={firmando}
              className="flex items-center justify-center gap-2 w-full py-3 bg-primary hover:bg-ink disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98]"
            >
              <i className="fa-solid fa-signature text-sm" />
              {firmando ? 'Firmando…' : 'Firmar mensaje de prueba'}
            </button>

            {signature && (
              <div className="text-center space-y-1">
                <p className="text-xs font-semibold text-emerald-600">Firma OK ✅</p>
                <p className="text-[10px] font-mono text-slate-400 break-all">{signature.slice(0, 40)}…</p>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-500 text-center leading-relaxed break-words">{error}</p>}
      </div>
    </div>
  );
}
