import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAppState } from '../context/AppState';
import AmountSlider from '../components/AmountSlider';
import PageHeader from '../components/PageHeader';
import { LOAN_CATEGORIES } from '../types';
import type { LoanCategory } from '../types';
import { showToast } from '../components/Toast';
import { apiGet, apiPost } from '../lib/api';
import { formatCOP } from '../lib/currency';

interface EventoScore {
  id: string;
  tipo_evento: string;
  delta: number;
  score_nuevo: number;
  created_at: string;
}

interface HistorialResponse {
  historial: {
    score_efectivo: number;
    eventos: EventoScore[];
  };
}

const EVENTO_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  pago_puntual:     { label: 'Pago puntual',     color: 'text-emerald-600', icon: 'fa-circle-check' },
  pago_atrasado:    { label: 'Pago atrasado',    color: 'text-rose-500',    icon: 'fa-circle-exclamation' },
  default:          { label: 'Default',          color: 'text-rose-700',    icon: 'fa-triangle-exclamation' },
  recalculo_manual: { label: 'Antigüedad',       color: 'text-sky-500',     icon: 'fa-clock-rotate-left' },
};

function ScoreHistorial({ eventos }: { eventos: EventoScore[] }) {
  if (!eventos.length) return null;
  return (
    <div className="border-t border-current/10 pt-3 space-y-1.5">
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Últimos movimientos de score</p>
      {eventos.map((ev) => {
        const meta = EVENTO_LABELS[ev.tipo_evento] ?? { label: ev.tipo_evento, color: 'text-slate-500', icon: 'fa-circle' };
        const sign = ev.delta >= 0 ? '+' : '';
        return (
          <div key={ev.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-slate-100">
            <div className="flex items-center gap-2">
              <i className={`fa-solid ${meta.icon} ${meta.color} text-[10px]`} />
              <span className="text-[10px] text-slate-600 font-medium">{meta.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black ${ev.delta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {sign}{ev.delta} pts
              </span>
              <span className="text-[9px] text-slate-400 font-mono">{ev.score_nuevo}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Request() {
  const { state, setSelectedAmount, setCategory, setTotalInstallments, submitLoan, refreshTokens } = useAppState();
  const [, navigate] = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [eventos, setEventos] = useState<EventoScore[]>([]);

  const MOCK_EVENTOS: EventoScore[] = [
    { id: '1', tipo_evento: 'pago_puntual',  delta: 2,  score_nuevo: 72, created_at: '' },
    { id: '2', tipo_evento: 'pago_puntual',  delta: 2,  score_nuevo: 70, created_at: '' },
    { id: '3', tipo_evento: 'pago_atrasado', delta: -1, score_nuevo: 68, created_at: '' },
    { id: '4', tipo_evento: 'pago_puntual',  delta: 2,  score_nuevo: 69, created_at: '' },
  ];

  useEffect(() => {
    if (state.creditEstado !== 'pendiente' && state.creditEstado !== 'desembolsado') return;

    if (!state.authToken) {
      setEventos(MOCK_EVENTOS);
      return;
    }

    apiGet<HistorialResponse>('/api/participantes/score/historial?limit=4', {
      token: state.authToken,
      refreshToken: state.refreshToken,
      onTokenRefresh: refreshTokens,
    })
      .then((res) => {
        const evs = res.historial.eventos;
        setEventos(evs.length ? evs : MOCK_EVENTOS);
      })
      .catch(() => setEventos(MOCK_EVENTOS));
  }, [state.authToken, state.creditEstado]);

  const handleCategoryClick = (cat: LoanCategory) => {
    setCategory(cat);
  };

  // Redirect if education not complete
  useEffect(() => {
    if (state.eduProgress < 100) {
      showToast('Educación Incompleta', 'Completa el módulo educativo primero.');
      navigate('/education');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      await apiPost('/api/creditos', {
        monto: state.selectedAmount,
        uso: state.category,
        descripcion: descripcion || undefined,
        plazo_dias: state.totalInstallments * 7,
        numero_cuotas: state.totalInstallments,
      }, {
        token: state.authToken,
        refreshToken: state.refreshToken,
        onTokenRefresh: refreshTokens,
      });

      submitLoan();
      showToast('Solicitud Enviada', 'Tu crédito está en revisión.', 'success');
      navigate('/repayment');
    } catch (err: any) {
      const msg = err?.message ?? err?.detail ?? 'Error al enviar solicitud';
      showToast('Error', msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5">
      <div className="space-y-4">
        <PageHeader
          title="Solicitar tu Crédito"
          subtitle="Solicita tu crédito y recibe tu COPm en tu wallet."
        />

        {/* Node alert */}
        {state.nodeAlert && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex gap-3 items-start">
            <i className="fa-solid fa-circle-exclamation text-rose-500 mt-0.5 text-sm shrink-0" />
            <div>
              <p className="text-xs font-bold text-rose-800">Alerta en tu red</p>
              <p className="text-[10px] text-rose-700 mt-0.5 leading-relaxed">
                Tu compañera <span className="font-bold">{state.alertPartnerName}</span> tiene pagos atrasados. Tu red tiene 48h para regularizar antes de que se suspenda el nodo.
              </p>
            </div>
          </div>
        )}

        {/* Active credit — replace form */}
        {state.creditEstado === 'pendiente' && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
              <i className="fa-solid fa-clock text-amber-500 mt-0.5 text-sm shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800">Solicitud en revisión</p>
                <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                  Tu solicitud está siendo evaluada por el equipo MANGLE. Podrás pedir un nuevo crédito una vez que este sea procesado.
                </p>
              </div>
            </div>
            <p className="text-xs font-bold text-slate-700">Detalle de tu solicitud</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className="text-[9px] text-slate-400 uppercase tracking-wide">Monto solicitado</p>
                <p className="text-base font-black text-slate-800 mt-1">{formatCOP(state.selectedAmount)}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">{state.moneda}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className="text-[9px] text-slate-400 uppercase tracking-wide">Plazo</p>
                <p className="text-base font-black text-slate-800 mt-1">{state.totalInstallments}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">semanas</p>
              </div>
            </div>
            <ScoreHistorial eventos={eventos} />
          </div>
        )}

        {state.creditEstado === 'desembolsado' && (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-3 items-start">
              <i className="fa-solid fa-circle-check text-emerald-500 mt-0.5 text-sm shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-800">Crédito activo</p>
                <p className="text-[10px] text-emerald-700 mt-0.5 leading-relaxed">
                  Tienes un crédito en curso. Completa el pago de todas tus cuotas para poder solicitar uno nuevo.
                </p>
              </div>
            </div>
            <p className="text-xs font-bold text-slate-700">Detalle de tu crédito</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className="text-[9px] text-slate-400 uppercase tracking-wide">Monto</p>
                <p className="text-base font-black text-slate-800 mt-1">{formatCOP(state.selectedAmount)}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">{state.moneda}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className="text-[9px] text-slate-400 uppercase tracking-wide">Pagadas</p>
                <p className="text-base font-black text-slate-800 mt-1">{state.installmentsPaid} / {state.totalInstallments}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">cuotas</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className="text-[9px] text-slate-400 uppercase tracking-wide">Restantes</p>
                <p className="text-base font-black text-emerald-600 mt-1">{state.totalInstallments - state.installmentsPaid}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">cuotas</p>
              </div>
            </div>
            <ScoreHistorial eventos={eventos} />
          </div>
        )}

        {/* Form — only when no active credit */}
        {(state.creditEstado === 'ninguno' || state.creditEstado === 'pagado') && (<>
          <AmountSlider
            value={state.selectedAmount}
            onChange={setSelectedAmount}
            installments={state.totalInstallments}
            onInstallmentsChange={setTotalInstallments}
          />

          {/* Category */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-900 block">¿En qué usarás tu crédito?</span>
            <div className="grid grid-cols-3 gap-2.5">
              {LOAN_CATEGORIES.map((cat) => {
                const isActive = state.category === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => handleCategoryClick(cat.key)}
                    className={`p-3 rounded-xl text-center flex items-center justify-center gap-1.5 transition ${
                      isActive ? 'border-2 border-[#2A5C3C]' : 'border border-slate-100 opacity-60'
                    } bg-white`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${
                      isActive ? 'bg-[#EBF4EE] text-[#2A5C3C]' : 'bg-slate-50 text-slate-500'
                    }`}>
                      <i className={`fa-solid fa-${cat.icon}`} />
                    </div>
                    <span className={`text-[10px] ${isActive ? 'font-bold text-slate-700' : 'font-medium text-slate-600'}`}>
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-900 block">
              Descripción <span className="text-[10px] font-normal text-slate-400">(opcional)</span>
            </span>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Describe tu solicitud. (opcional)"
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:border-[#2A5C3C] transition"
            />
          </div>
        </>)}
      </div>

      {/* Submit — only when form is visible */}
      {(state.creditEstado === 'ninguno' || state.creditEstado === 'pagado') && (
        <div className="pt-3">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 bg-[#2A5C3C] hover:bg-[#1E3E28] disabled:opacity-50 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all"
          >
            {submitting ? 'Procesando...' : 'Enviar Solicitud'}
          </button>
        </div>
      )}
    </div>
  );
}
