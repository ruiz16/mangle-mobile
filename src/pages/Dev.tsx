import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppState } from '../context/AppState';
import PageHeader from '../components/PageHeader';
import { showToast } from '../components/Toast';
import { useGaccSemaforo } from '../queries/gacc';
import { useDispararAlerta, useResolverAlerta, type AlertaSnapshot } from '../queries/dev';

// Clave del snapshot de la simulación. Es el ÚNICO estado local del Dev: guarda
// los valores previos (score + cuota) que devuelve el disparo para que el botón
// "Resolver" pueda restaurarlos vía backend. No es estado de negocio.
const SNAPSHOT_KEY = 'mangle:dev:alerta-snapshot';

function loadSnapshot(): AlertaSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as AlertaSnapshot) : null;
  } catch {
    return null;
  }
}

export default function Dev() {
  const { resetState } = useAppState();
  const [, navigate] = useLocation();

  // Semáforo del servidor = fuente de verdad del estado de alerta.
  const { data: semaforo, isLoading: semaforoLoading } = useGaccSemaforo();
  const alertaActiva = !!semaforo && semaforo.semaforo !== 'verde';

  const disparar = useDispararAlerta();
  const resolver = useResolverAlerta();
  const [snapshot, setSnapshot] = useState<AlertaSnapshot | null>(loadSnapshot);

  const busy = disparar.isPending || resolver.isPending;

  const handleDisparar = async () => {
    try {
      const res = await disparar.mutateAsync();
      sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(res.snapshot));
      setSnapshot(res.snapshot);
      showToast('Alerta Activada', 'Mora simulada en el GACC. Score y semáforo actualizados.', 'warning');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo disparar la alerta';
      showToast('Error', msg, 'error');
    }
  };

  const handleResolver = async () => {
    if (!snapshot) return;
    try {
      await resolver.mutateAsync(snapshot);
      sessionStorage.removeItem(SNAPSHOT_KEY);
      setSnapshot(null);
      showToast('Alerta Resuelta', 'Crédito, GACC y scores restaurados a su estado previo.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo resolver la alerta';
      showToast('Error', msg, 'error');
    }
  };

  const handleReset = () => {
    resetState();
    showToast('Reset', 'Estado de sesión restaurado a valores iniciales.', 'warning');
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
          <span className="text-slate-400 block">Semáforo GACC (servidor)</span>
          <span className={`font-bold ${alertaActiva ? 'text-danger-600' : 'text-emerald-600'}`}>
            {semaforoLoading ? 'CARGANDO…' : alertaActiva ? `EN ALERTA (${semaforo?.semaforo})` : 'VERDE / AL DÍA'}
          </span>
        </div>
      </div>

      {/* Triggers */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold text-slate-600 block uppercase tracking-wider">Triggers de Red</span>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleDisparar}
            disabled={busy || !!snapshot}
            className="py-3 px-3 bg-danger-50 hover:bg-danger-100 disabled:opacity-30 border border-danger-200 text-danger-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <i className={`fa-solid ${disparar.isPending ? 'fa-spinner fa-spin' : 'fa-triangle-exclamation'}`} /> Activar Alerta GACC
          </button>

          <button
            onClick={handleResolver}
            disabled={busy || !snapshot}
            className="py-3 px-3 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-30 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <i className={`fa-solid ${resolver.isPending ? 'fa-spinner fa-spin' : 'fa-shield-halved'}`} /> Resolver Alerta
          </button>
        </div>

        {snapshot ? (
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Snapshot guardado (score previo: {snapshot.score_anterior}). "Resolver" restaurará crédito, GACC y scores.
          </p>
        ) : (
          <p className="text-[10px] text-slate-400 leading-relaxed">
            "Activar" marca una cuota tuya en mora y degrada tu score. Requiere un crédito desembolsado con cuotas pendientes.
          </p>
        )}
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
