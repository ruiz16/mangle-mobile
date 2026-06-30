import { useLocation } from 'wouter';
import { useCopmBalance } from '../queries/wallet';
import { formatCopmBalance } from '../lib/currency';

/** Chip de saldo COPm. Visible en páginas de dinero; abre /wallet al tocar. */
export default function WalletChip() {
  const [, navigate] = useLocation();
  const { data: balance, isLoading, isFetching } = useCopmBalance();

  return (
    <button
      onClick={() => navigate('/wallet')}
      className="flex items-center gap-2 rounded-full bg-white/90 backdrop-blur border border-slate-100 shadow-sm pl-3 pr-3.5 py-1.5 active:scale-95 transition"
      aria-label="Ver mi saldo"
    >
      <i className="fa-solid fa-wallet text-primary text-xs" />
      <span className="text-xs font-bold text-ink tabular-nums">
        {isLoading ? '···' : balance != null ? formatCopmBalance(balance) : '—'}
      </span>
      {isFetching && !isLoading && (
        <i className="fa-solid fa-circle-notch fa-spin text-[9px] text-slate-400" />
      )}
    </button>
  );
}
