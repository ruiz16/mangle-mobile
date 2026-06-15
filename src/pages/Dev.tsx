import { useLocation } from 'wouter';
import { useAppState } from '../context/AppState';
import PageHeader from '../components/PageHeader';
import { showToast } from '../components/Toast';

export default function Dev() {
  const {
    state,
    triggerNodeAlert,
    restoreNodeAlert,
    resetState,
  } = useAppState();
  const [, navigate] = useLocation();

  const handleReset = () => {
    resetState();
    showToast('Reset', 'Estado restaurado a valores iniciales.', 'warning');
    navigate('/');
  };

  return (
    <div className="flex-1 p-5 space-y-5">
      <PageHeader
        title="Debug / Simulación"
        subtitle="Panel de Desarrollo"
      />

      {/* State indicators */}
      <div className="grid grid-cols-1 gap-2 text-[10px] font-mono">
        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
          <span className="text-slate-400 block">Alerta GACC</span>
          <span className={`font-bold ${state.nodeAlert ? 'text-danger-600' : 'text-emerald-600'}`}>
            {state.nodeAlert ? 'ACTIVA' : 'INACTIVA'}
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
            className="py-3 px-3 bg-danger-50 hover:bg-danger-100 disabled:opacity-30 border border-danger-200 text-danger-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
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

      {/* Reset */}
      <button
        onClick={handleReset}
        className="w-full py-3 bg-danger-50 hover:bg-danger-100 border border-danger-200 text-danger-600 text-xs font-bold rounded-xl transition"
      >
        <i className="fa-solid fa-rotate-left mr-1.5" /> Reset Completo (volver a Splash)
      </button>
    </div>
  );
}
