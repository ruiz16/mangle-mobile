import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppState } from '../context/AppState';
import { useCopmBalance } from '../queries/wallet';
import { formatCopmBalance } from '../lib/currency';
import { ACTIVE_NETWORK } from '../lib/network';
import PageHeader from '../components/PageHeader';

export default function Wallet() {
  const { state } = useAppState();
  const [, navigate] = useLocation();
  const { data: balance, isLoading, isError, isFetching, refetch } = useCopmBalance();
  const [copied, setCopied] = useState(false);
  const address = state.walletAddress;

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!address) {
    return (
      <div className="flex-1 flex flex-col p-5 gap-6">
        <PageHeader title="Tu Wallet" subtitle="Tu saldo" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <i className="fa-solid fa-wallet text-4xl text-slate-300" />
          <p className="text-sm text-slate-500">Conectá tu billetera para ver tu saldo.</p>
          <button
            onClick={() => navigate('/connect')}
            className="rounded-full bg-primary text-white text-sm font-bold px-6 py-2.5"
          >
            Conectar billetera
          </button>
        </div>
      </div>
    );
  }

  const truncated = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <div className="flex-1 flex flex-col p-5 gap-6">
      <PageHeader title="Tu Wallet" subtitle="Tu saldo" />

      {/* Saldo en vivo */}
      <div className="rounded-3xl p-6 bg-white border border-slate-100 shadow-sm flex flex-col items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-slate-400">Saldo disponible</span>
        <span className="text-4xl font-black text-ink tabular-nums">
          {isLoading ? '···' : balance != null ? formatCopmBalance(balance) : '—'}
        </span>
        <span className="text-xs text-slate-400">pesos</span>
        {isFetching && !isLoading && (
          <span className="text-[10px] text-slate-400">
            <i className="fa-solid fa-circle-notch fa-spin mr-1" />Actualizando…
          </span>
        )}
        {isError && (
          <button onClick={() => refetch()} className="text-[11px] text-orange-500 mt-1">
            No pudimos refrescar. Reintentar
          </button>
        )}
      </div>

      {/* Dirección */}
      <button
        onClick={copy}
        className="flex items-center justify-between rounded-2xl p-4 bg-white border border-slate-100 shadow-sm"
      >
        <div className="flex flex-col items-start">
          <span className="text-[9px] uppercase tracking-wider text-slate-400">Tu cuenta</span>
          <span className="text-xs font-mono text-slate-700">{truncated}</span>
        </div>
        <i className={`fa-solid ${copied ? 'fa-check text-green-500' : 'fa-copy text-slate-400'} text-sm`} />
      </button>

      {/* Modo prueba — solo visible en testnet */}
      {ACTIVE_NETWORK !== 'mainnet' && (
        <div className="flex items-center justify-center">
          <span className="rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold px-3 py-1 tracking-wide">
            Modo prueba
          </span>
        </div>
      )}
    </div>
  );
}
