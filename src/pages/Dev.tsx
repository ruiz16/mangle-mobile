import { useLocation } from 'wouter';
import { useAppState } from '../context/AppState';
import { showToast } from '../components/Toast';

export default function Dev() {
  const {
    state,
    triggerNodeAlert,
    restoreNodeAlert,
    addReputation,
    payInstallment,
    resetState,
    submitLoan,
    approveLoan,
  } = useAppState();
  const [, navigate] = useLocation();

  const handleReset = () => {
    resetState();
    showToast('Reset', 'Estado restaurado a valores iniciales.', 'warning');
    navigate('/');
  };

  return (
    <div className="flex-1 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">🛠 Panel de Desarrollo</span>
          <h3 className="text-lg font-black text-slate-800">Debug / Simulación</h3>
        </div>
        <button
          onClick={() => navigate('/repayment')}
          className="px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 transition"
        >
          <i className="fa-solid fa-arrow-left mr-1" /> Volver
        </button>
      </div>

      {/* State indicators */}
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
          <span className="text-slate-400 block">Reputación</span>
          <span className="font-bold text-slate-800">{state.reputation}%</span>
        </div>
        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
          <span className="text-slate-400 block">Cuotas Pagadas</span>
          <span className="font-bold text-slate-800">{state.installmentsPaid}/{state.totalInstallments}</span>
        </div>
        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
          <span className="text-slate-400 block">Alerta GACC</span>
          <span className={`font-bold ${state.nodeAlert ? 'text-rose-600' : 'text-emerald-600'}`}>
            {state.nodeAlert ? 'ACTIVA' : 'INACTIVA'}
          </span>
        </div>
        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
          <span className="text-slate-400 block">Estado Crédito</span>
          <span className={`font-bold ${
            state.creditEstado === 'desembolsado' ? 'text-emerald-600' :
            state.creditEstado === 'pendiente' ? 'text-amber-600' :
            state.creditEstado === 'pagado' ? 'text-blue-600' :
            'text-slate-400'
          }`}>
            {state.creditEstado === 'ninguno' ? '—' : state.creditEstado.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Triggers */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold text-slate-600 block uppercase tracking-wider">Triggers de Red</span>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              triggerNodeAlert();
              showToast('Alerta Activada', 'Retraso simulado de 48h en el GACC.', 'warning');
            }}
            disabled={state.nodeAlert}
            className="py-3 px-3 bg-rose-50 hover:bg-rose-100 disabled:opacity-30 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <i className="fa-solid fa-triangle-exclamation" /> Activar Alerta GACC
          </button>

          <button
            onClick={() => {
              restoreNodeAlert();
              showToast('Alerta Resuelta', 'Garantía Social restaurada.', 'success');
            }}
            disabled={!state.nodeAlert}
            className="py-3 px-3 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-30 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <i className="fa-solid fa-shield-halved" /> Resolver Alerta
          </button>
        </div>
      </div>

      {/* Score controls */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold text-slate-600 block uppercase tracking-wider">Score de Reputación</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => addReputation(10)}
            disabled={state.reputation >= 100}
            className="py-3 px-3 bg-blue-50 hover:bg-blue-100 disabled:opacity-30 border border-blue-200 text-blue-700 text-xs font-bold rounded-xl transition"
          >
            +10 Aumentar Score
          </button>
          <button
            onClick={() => addReputation(-15)}
            disabled={state.reputation <= 0}
            className="py-3 px-3 bg-orange-50 hover:bg-orange-100 disabled:opacity-30 border border-orange-200 text-orange-700 text-xs font-bold rounded-xl transition"
          >
            -15 Bajar Score
          </button>
        </div>
      </div>

      {/* Credit controls */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold text-slate-600 block uppercase tracking-wider">Crédito</span>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              submitLoan();
              showToast('Crédito Solicitado', 'Estado → pendiente', 'success');
            }}
            disabled={state.creditEstado !== 'ninguno'}
            className="py-3 px-3 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-30 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl transition"
          >
            Solicitar
          </button>
          <button
            onClick={() => {
              approveLoan();
              showToast('Crédito Desembolsado', 'Estado → desembolsado', 'success');
            }}
            disabled={state.creditEstado !== 'pendiente'}
            className="py-3 px-3 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-30 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl transition"
          >
            Desembolsar
          </button>
          <button
            onClick={() => {
              payInstallment();
              showToast('Cuota Pagada', 'Simulación de pago completada.', 'success');
            }}
            disabled={state.creditEstado !== 'desembolsado' || state.installmentsPaid >= state.totalInstallments}
            className="py-3 px-3 bg-teal-50 hover:bg-teal-100 disabled:opacity-30 border border-teal-200 text-teal-700 text-xs font-bold rounded-xl transition"
          >
            Pagar Cuota
          </button>
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={handleReset}
        className="w-full py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-bold rounded-xl transition"
      >
        <i className="fa-solid fa-rotate-left mr-1.5" /> Reset Completo (volver a Splash)
      </button>
    </div>
  );
}
