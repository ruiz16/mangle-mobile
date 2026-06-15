import { useAppState } from '../context/AppState';
import PageHeader from '../components/PageHeader';
import { useProfile, useScore } from '../queries/perfil';

function scoreLabel(score: number): { text: string; color: string } {
  if (score >= 80) return { text: 'Excelente', color: '#4ade80' };
  if (score >= 60) return { text: 'Bueno', color: '#fbbf24' };
  if (score >= 40) return { text: 'Regular', color: '#fb923c' };
  return { text: 'En construcción', color: '#94a3b8' };
}

export default function Credential() {
  const { state } = useAppState();
  const { data: profileData } = useProfile();
  const fullName = profileData?.participante.nombre ?? '';
  const { score, antiguedad } = useScore();

  const { text: label, color: labelColor } = scoreLabel(score);
  const truncatedAddress = state.walletAddress
    ? `${state.walletAddress.slice(0, 6)}…${state.walletAddress.slice(-4)}`
    : '—';

  const radius = 52;
  const sw = 5;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex-1 flex flex-col p-5 gap-6 relative overflow-hidden">

      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 45% at 50% 52%, rgba(217,119,6,0.13) 0%, transparent 70%)' }}
      />

      <PageHeader title="Tu Reputación On-Chain" subtitle="Credencial Digital" />

      {/* Card */}
      <div className="mx-auto w-full max-w-[272px]">
        <div
          className="relative rounded-2xl overflow-hidden text-white"
          style={{
            background: 'linear-gradient(140deg, #78350f 0%, #d97706 38%, #fbbf24 62%, #92400e 100%)',
            boxShadow: '0 24px 64px rgba(217,119,6,0.3), 0 4px 16px rgba(0,0,0,0.6)',
            animation: 'float 4.5s ease-in-out infinite',
          }}
        >
          {/* Shimmer */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(108deg, transparent 38%, rgba(255,255,255,0.1) 50%, transparent 62%)',
              animation: 'shimmer 3.5s ease-in-out infinite',
            }}
          />
          {/* Top-right corner glow blob */}
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-yellow-300/20 blur-2xl pointer-events-none" />

          <div className="relative p-5 flex flex-col gap-5">
            {/* Header row */}
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[7px] uppercase tracking-[0.25em] text-amber-200/60 font-semibold">Garantía Social</p>
                <p className="text-sm font-black tracking-wide font-display">MANGLE VC</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center border border-white/15">
                <i className="fa-solid fa-dragon text-amber-200 text-sm" />
              </div>
            </div>

            {/* Score ring */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <svg width={120} height={120} className="-rotate-90">
                  <circle cx={60} cy={60} r={radius} stroke="rgba(0,0,0,0.25)" strokeWidth={sw} fill="none" />
                  <circle
                    cx={60} cy={60} r={radius}
                    stroke="white"
                    strokeWidth={sw}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    style={{
                      transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)',
                      filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.55))',
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[28px] font-black leading-none">{score}</span>
                  <span className="text-[7px] text-amber-200/70 uppercase tracking-widest mt-0.5">puntos</span>
                </div>
              </div>
              <span
                className="text-[9px] font-bold uppercase tracking-widest px-3 py-0.5 rounded-full"
                style={{ background: 'rgba(0,0,0,0.22)', color: labelColor, border: `1px solid ${labelColor}50` }}
              >
                {label}
              </span>
            </div>

            {/* Footer row */}
            <div className="flex justify-between items-end pt-1 border-t border-white/10">
              <div>
                <p className="text-[7px] text-amber-200/50 uppercase tracking-wider">Titular</p>
                <p className="text-[11px] font-bold">{fullName || '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-[7px] text-amber-200/50 uppercase tracking-wider">Wallet</p>
                <p className="text-[9px] font-mono text-amber-100/80">{truncatedAddress}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Score', value: String(score) },
          { label: 'Antigüedad', value: `${antiguedad}m` },
          { label: 'Estado', value: 'Válido' },
        ].map(({ label: l, value }) => (
          <div key={l} className="flex flex-col items-center gap-2 rounded-2xl p-4 bg-white border border-slate-100 shadow-sm">
            <span className="text-base font-black text-slate-800 leading-none">{value}</span>
            <span className="text-[9px] text-slate-400 uppercase tracking-wide">{l}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-600 text-center px-6 leading-relaxed">
        Esta credencial vive de forma auditable como un NFT dinámico en tu wallet MiniPay. Tu pasaporte de confianza para la Fase 2.
      </p>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-0.4deg); }
          50% { transform: translateY(-7px) rotate(0.4deg); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-120%); }
          65%, 100% { transform: translateX(220%); }
        }
      `}</style>
    </div>
  );
}
