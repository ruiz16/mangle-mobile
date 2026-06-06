import { useLocation } from 'wouter';
import { useAppState } from '../context/AppState';
import PageHeader from '../components/PageHeader';
import ScoreRing from '../components/ScoreRing';

export default function Credential() {
  const { state } = useAppState();
  const [, navigate] = useLocation();

  return (
    <div className="flex-1 flex flex-col justify-between p-5">
      <div className="space-y-12">
        <PageHeader
          title="Tu Reputación On-Chain"
          subtitle="Credencial Digital"
        />

        {/* NFT Card */}
        <div className="w-full max-w-[240px] mx-auto bg-gradient-to-br from-amber-800 via-yellow-400 to-amber-600 rounded-2xl shadow-lg p-4 text-white flex flex-col justify-between h-[280px] relative overflow-hidden text-left">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-white/10 blur-xl" />

          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-[8px] uppercase tracking-wider text-amber-100">Garantía Social</span>
              <span className="text-xs font-bold font-serif">MANGLE VC</span>
            </div>
            <i className="fa-solid fa-dragon text-amber-200 text-lg" />
          </div>

          <div className="flex flex-col items-center my-2">
            <ScoreRing score={state.reputation} />
            <span className="text-[9px] font-bold text-amber-100 mt-1">Score de Confianza</span>
          </div>

          <div className="flex justify-between items-end text-[9px]">
            <div className="flex flex-col">
              <span className="text-[7px] text-amber-100">Titular</span>
              <span className="font-bold">{state.fullName || '—'}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[7px] text-amber-100">Estado</span>
              <span className="font-bold bg-white/20 px-1 rounded-sm">Válido</span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 px-4 leading-relaxed">
          Esta credencial vive de manera auditable y segura como un NFT dinámico en tu wallet MiniPay. Sirve como tu pasaporte de confianza para la Fase 2.
        </p>
      </div>
    </div>
  );
}
