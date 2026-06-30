import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAppState } from '../context/AppState';
import AmountSlider from '../components/AmountSlider';
import PageHeader from '../components/PageHeader';
import { LOAN_CATEGORIES } from '../types';
import type { LoanCategory } from '../types';
import { showToast } from '../components/Toast';
import { apiGet } from '../lib/api';
import { formatCOP } from '../lib/currency';
import { useCreditoActivo, useSolicitarCredito } from '../queries/creditos';
import { useCuotas, cuotasPagadas } from '../queries/cuotas';
import { useEduProgreso } from '../queries/educacion';
import { useMiAlerta, mensajeAlerta } from '../queries/gacc';

interface Referadora {
  participanteId: string;
  nombre: string;
  score: number;
}

interface MiGrupoResponse {
  grupo: { id: string; nombre: string; codigo: string; municipio: string } | null;
  miembro: { id: string; nombre: string; validado: boolean } | null;
  miembros?: Array<{
    id: string;
    participante_id: string;
    validado_en: string | null;
    score_efectivo: number | null;
    participante: { nombre: string; score_reputacion: number } | null;
  }>;
}

const CREDITO_ERROR_MSG: Record<string, string> = {
  REFERADORA_INVALIDA:      'No puedes elegirte a ti misma como referadora.',
  REFERADORA_NO_ENCONTRADA: 'La referadora seleccionada ya no existe.',
  REFERADORA_OTRO_GACC:     'La referadora debe pertenecer a tu mismo GACC.',
  REFERADORA_NO_VALIDADA:   'La referadora aún no fue validada en el GACC.',
  GACC_RESTRINGIDO:         'Tu GACC está restringido por bajo puntaje colectivo. No puede solicitar nuevos créditos por ahora.',
  SIN_GACC:                 'Debes pertenecer a un GACC para solicitar un crédito.',
  GACC_NO_VALIDADO:         'Debes ser validada por tu GACC antes de solicitar un crédito.',
  EDUCACION_INCOMPLETA:     'Completa el módulo educativo antes de solicitar un crédito.',
  CREDITO_ACTIVO:           'Ya tienes un crédito activo. Termina de pagarlo antes de solicitar uno nuevo.',
};

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
  pago_puntual:     { label: 'Pago puntual',  color: 'text-emerald-600', icon: 'fa-circle-check' },
  pago_atrasado:    { label: 'Pago atrasado', color: 'text-danger-500',  icon: 'fa-circle-exclamation' },
  default:          { label: 'Default',       color: 'text-danger-700',  icon: 'fa-triangle-exclamation' },
  recalculo_manual: { label: 'Antigüedad',   color: 'text-sky-500',     icon: 'fa-clock-rotate-left' },
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

// Solo muestra la sección si hay eventos reales — nunca datos de relleno
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
              <div className="flex flex-col items-start">
                <span className="text-[10px] text-slate-600 font-medium">{meta.label}</span>
                <span className="text-[9px] text-slate-400 font-mono">{formatDate(ev.created_at)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black ${ev.delta >= 0 ? 'text-emerald-600' : 'text-danger-500'}`}>
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
  const { state, refreshTokens } = useAppState();
  const miAlerta = useMiAlerta();
  const [, navigate] = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [eventos, setEventos] = useState<EventoScore[]>([]);
  const [referadoras, setReferadoras] = useState<Referadora[]>([]);
  const [referadoraId, setReferadoraId] = useState('');
  const [selectedAmount, setSelectedAmount] = useState(100000);
  const [category, setCategory] = useState<LoanCategory>('insumos');
  const [totalInstallments, setTotalInstallments] = useState(4);

  const { credito, estado: creditEstado, isLoading: creditLoading } = useCreditoActivo();
  const { progress: eduProgress, isLoading: eduLoading } = useEduProgreso();
  const { data: cuotasData } = useCuotas();
  const installmentsPaid = credito ? cuotasPagadas(cuotasData?.cuotas ?? [], credito.id) : 0;
  const solicitar = useSolicitarCredito();

  // Cargar historial SOLO cuando el crédito está desembolsado (hay pagos reales posibles).
  // En estado 'pendiente' no puede haber movimientos de score por pagos — no mostrar nada.
  useEffect(() => {
    if (creditEstado !== 'desembolsado') {
      setEventos([]);
      return;
    }
    if (!state.authToken) return;

    apiGet<HistorialResponse>('/api/participantes/score/historial', {
      token: state.authToken,
      refreshToken: state.refreshToken,
      onTokenRefresh: refreshTokens,
    })
      .then((res) => setEventos(res.historial.eventos ?? []))
      .catch(() => setEventos([]));
  }, [state.authToken, creditEstado]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!state.authToken) return;
    apiGet<MiGrupoResponse>('/api/gacc/mi-grupo', {
      token: state.authToken,
      refreshToken: state.refreshToken,
      onTokenRefresh: refreshTokens,
    })
      .then((res) => {
        const lista = (res.miembros ?? [])
          .filter((m) => m.validado_en && m.participante && m.participante_id !== res.miembro?.id)
          .map((m) => ({
            participanteId: m.participante_id,
            nombre: m.participante!.nombre,
            score: m.score_efectivo ?? m.participante!.score_reputacion ?? 0,
          }));
        setReferadoras(lista);
      })
      .catch(() => setReferadoras([]));
  }, [state.authToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!eduLoading && eduProgress < 100) {
      showToast('Educación Incompleta', 'Completa el módulo educativo primero.');
      navigate('/education');
    }
  }, [eduLoading, eduProgress]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!referadoraId) {
      showToast('Elige una referadora', 'Debes elegir una referadora de tu GACC para este crédito.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await solicitar.mutateAsync({
        monto: selectedAmount,
        uso: category,
        referadora_id: referadoraId,
        descripcion: descripcion || undefined,
        plazo_dias: totalInstallments * 7,
        numero_cuotas: totalInstallments,
      });
      showToast('Solicitud Enviada', 'Tu crédito está en revisión. La referadora recibirá tu solicitud de aval.', 'success');
      navigate('/repayment');
    } catch (err: any) {
      const code: string | undefined = err?.code ?? err?.error;
      const msg = (code && CREDITO_ERROR_MSG[code]) || err?.message || err?.detail || 'Error al enviar solicitud';
      showToast('Error', msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5">
      <div className="space-y-4">
        <PageHeader title="Solicitar tu Crédito" subtitle="Solicita tu crédito y recibe tu dinero." />

        {miAlerta.alerta && (
          <div className="bg-danger-50 border border-danger-200 rounded-2xl p-4 flex gap-3 items-start">
            <i className="fa-solid fa-circle-exclamation text-danger-500 mt-0.5 text-sm shrink-0" />
            <div>
              <p className="text-xs font-bold text-danger-800">Alerta en tu red</p>
              <p className="text-[10px] text-danger-700 mt-0.5 leading-relaxed">{mensajeAlerta(miAlerta)}</p>
              {miAlerta.rol === 'referadora' && (
                <button
                  type="button"
                  disabled
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-[10px] font-bold text-white opacity-70"
                >
                  <i className="fa-brands fa-whatsapp text-xs" />
                  <span>Chat en WhatsApp</span>
                </button>
              )}
            </div>
          </div>
        )}

        {creditLoading && (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <i className="fa-solid fa-spinner fa-spin text-3xl text-primary" />
            <p className="text-xs text-slate-500">Verificando estado de crédito...</p>
          </div>
        )}

        {!creditLoading && creditEstado === 'pendiente' && (
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
                <p className="text-base font-black text-slate-800 mt-1">{formatCOP(Number(credito?.monto ?? 0))}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">pesos</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className="text-[9px] text-slate-400 uppercase tracking-wide">Plazo</p>
                <p className="text-base font-black text-slate-800 mt-1">{credito?.numero_cuotas ?? 0}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">semanas</p>
              </div>
            </div>
            {/* Sin ScoreHistorial aquí — el crédito no fue desembolsado, no hay pagos */}
          </div>
        )}

        {!creditLoading && creditEstado === 'desembolsado' && (
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
                <p className="text-base font-black text-slate-800 mt-1">{formatCOP(Number(credito?.monto ?? 0))}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">pesos</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className="text-[9px] text-slate-400 uppercase tracking-wide">Pagadas</p>
                <p className="text-base font-black text-slate-800 mt-1">{installmentsPaid} / {credito?.numero_cuotas ?? 0}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">cuotas</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className="text-[9px] text-slate-400 uppercase tracking-wide">Restantes</p>
                <p className="text-base font-black text-emerald-600 mt-1">{(credito?.numero_cuotas ?? 0) - installmentsPaid}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">cuotas</p>
              </div>
            </div>
            {/* Historial de score solo cuando hay pagos reales posibles */}
            <ScoreHistorial eventos={eventos} />
          </div>
        )}

        {!creditLoading && (creditEstado === 'ninguno' || creditEstado === 'pagado') && (<>
          <AmountSlider
            value={selectedAmount}
            onChange={setSelectedAmount}
            installments={totalInstallments}
            onInstallmentsChange={setTotalInstallments}
          />

          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-900 block">¿En qué usarás tu crédito?</span>
            <div className="grid grid-cols-3 gap-2.5">
              {LOAN_CATEGORIES.map((cat) => {
                const isActive = category === cat.key;
                return (
                  <button key={cat.key} onClick={() => setCategory(cat.key)}
                    className={`p-3 rounded-xl text-center flex items-center justify-center gap-1.5 transition ${isActive ? 'border-2 border-primary' : 'border border-slate-100 opacity-60'} bg-white`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${isActive ? 'bg-surface text-primary' : 'bg-slate-50 text-slate-500'}`}>
                      <i className={`fa-solid fa-${cat.icon}`} />
                    </div>
                    <span className={`text-[10px] ${isActive ? 'font-bold text-slate-700' : 'font-medium text-slate-600'}`}>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-900 block">Descripción <span className="text-[10px] font-normal text-slate-400">(opcional)</span></span>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={500} rows={3}
              placeholder="Describe tu solicitud. (opcional)"
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:border-primary transition" />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-900 block">Elegí tu referadora para este crédito</span>
            <p className="text-[10px] text-slate-400 leading-relaxed">Una compañera de tu GACC dará el primer aval (1/2). Luego el Líder Social dará el segundo (2/2).</p>
            {referadoras.length === 0 ? (
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <i className="fa-solid fa-spinner fa-spin text-primary text-sm" />
                <span className="text-xs text-slate-500">Cargando referadoras...</span>
              </div>
            ) : (
              <select value={referadoraId} onChange={(e) => setReferadoraId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-primary transition">
                <option value="">Selecciona una referadora…</option>
                {referadoras.map((r) => (
                  <option key={r.participanteId} value={r.participanteId}>{r.nombre} (score {r.score})</option>
                ))}
              </select>
            )}
          </div>
        </>)}
      </div>

      {!creditLoading && (creditEstado === 'ninguno' || creditEstado === 'pagado') && (
        <div className="pt-3">
          <button onClick={handleSubmit} disabled={submitting || !referadoraId}
            className="w-full py-3.5 bg-primary hover:bg-ink disabled:opacity-50 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all">
            {submitting ? 'Procesando' : 'Enviar Solicitud'}
          </button>
        </div>
      )}
    </div>
  );
}
