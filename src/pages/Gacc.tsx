import { useState } from 'react';
import { useAppState } from '../context/AppState';
import MemberCard from '../components/MemberCard';
import PageHeader from '../components/PageHeader';
import { showToast } from '../components/Toast';
import { useMiGrupo, usePendientesAval, useGaccSemaforo, useAvalar } from '../queries/gacc';

export default function Gacc() {
  const { state, showErrorModal } = useAppState();
  const [loadingAval, setLoadingAval] = useState<string | null>(null); // credito_id being avalado

  // Server-state vía TanStack Query (única fuente de verdad).
  const { grupo } = useMiGrupo();
  const { data: pendientesData } = usePendientesAval();
  const { data: gaccStats } = useGaccSemaforo();
  const avalar = useAvalar();
  const pendingCredits = pendientesData?.creditos ?? [];

  const gaccKey = grupo?.municipio || '';
  const members = grupo?.members ?? [];
  const gaccCodeSafe = grupo?.codigo || '—';
  const avgScore =
    members.length > 0
      ? Math.round(members.reduce((sum, m) => sum + m.score, 0) / members.length)
      : 0;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(gaccCodeSafe);
    showToast('Código Copiado', `Comparte el código ${gaccCodeSafe} con tus compañeras.`, 'success');
  };

  const handleAvalar = async (creditoId: string) => {
    setLoadingAval(creditoId);
    try {
      await avalar.mutateAsync(creditoId);
      // La invalidación de ['gacc-pendientes-aval'] refresca la lista sola.
      showToast('Aval Registrado', 'Has avalado este crédito con éxito.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al avalar el crédito';
      showErrorModal('Error al avalar', msg);
    } finally {
      setLoadingAval(null);
    }
  };

  const creditsToAval = pendingCredits.filter((c) => c.mi_rol !== null && !c.es_propio);
  const ownPendingCredit = pendingCredits.find((c) => c.es_propio) ?? null;

  return (
    <div className="flex-1 flex flex-col justify-between p-5">
      <div className="space-y-4">
        <PageHeader
          title="Mi Grupo GACC"
          subtitle="Ver y administrar tu grupo GACC."
          right={
            <span className="text-[9px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">
              {gaccKey.charAt(0).toUpperCase() + gaccKey.slice(1)}
            </span>
          }
        />

        {/* Community Alert */}
        {state.nodeAlert && (
          <div className="bg-danger-50 border border-danger-200 rounded-2xl p-4 flex gap-3 items-start">
            <i className="fa-solid fa-circle-exclamation text-danger-500 mt-0.5 text-sm shrink-0" />
            <div>
              <p className="text-xs font-bold text-danger-800">Garantía Social Comprometida</p>
              <p className="text-[10px] text-danger-700 mt-0.5 leading-relaxed">
                Tu compañera <span className="font-bold">{state.alertPartnerName}</span> presenta retraso. Tu red tiene 48h para apoyarla antes de suspender el nodo.
              </p>
            </div>
          </div>
        )}

        {/* Invitation Code */}
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">
              Código de Invitación (Privado)
            </span>
            <span
              className="text-[9px] text-primary underline cursor-pointer font-bold"
              onClick={handleCopyCode}
            >
              Copiar
            </span>
          </div>
          <span className="text-lg font-black text-slate-800 tracking-widest select-all">
            {gaccCodeSafe}
          </span>
        </div>

        {/* Group Info */}
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">
              Grupo
            </span>
            <span className="text-[10px] font-bold text-slate-600">
              <span>{members.length} miembro{members.length !== 1 ? 's' : ''}</span>
            </span>
          </div>
          <span className="text-sm font-bold text-slate-800">{grupo?.nombre}</span>
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <span className="text-[10px] bg-ink text-white px-2 py-0.5 rounded-full font-bold">
              <span>Score del GACC: {gaccStats ? Math.round(gaccStats.score_gacc) : avgScore}</span>
            </span>
            {gaccStats && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 ${
                  gaccStats.semaforo === 'verde'
                    ? 'bg-emerald-100 text-emerald-700'
                    : gaccStats.semaforo === 'amarillo'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-danger-100 text-danger-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    gaccStats.semaforo === 'verde'
                      ? 'bg-emerald-500'
                      : gaccStats.semaforo === 'amarillo'
                        ? 'bg-amber-500'
                        : 'bg-danger-500'
                  }`}
                />
                <span>
                  {gaccStats.semaforo === 'verde'
                    ? 'Al día'
                    : gaccStats.semaforo === 'amarillo'
                      ? 'En mora leve'
                      : 'En mora grave'}
                </span>
              </span>
            )}
            {gaccStats?.estado === 'restringido' && (
              <span className="text-[10px] bg-danger-600 text-white px-2 py-0.5 rounded-full font-bold">
                Restringido
              </span>
            )}
          </div>
        </div>

        {/* Own pending credit — read-only progress card */}
        {ownPendingCredit && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Mi solicitud de crédito
            </h4>
            <div className="bg-surface p-3 rounded-2xl border border-primary/20 shadow-sm space-y-2">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-extrabold text-primary bg-white px-2 py-0.5 rounded-full border border-primary/30">
                      Tu crédito
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium">
                    ${Number(ownPendingCredit.monto).toLocaleString('es-CO')} COPm
                  </p>
                  {ownPendingCredit.descripcion && (
                    <p className="text-[10px] text-slate-400 italic">
                      {ownPendingCredit.descripcion}
                    </p>
                  )}
                  {ownPendingCredit.referadora_nombre && (
                    <p className="text-[10px] text-slate-500 inline-flex items-center gap-1">
                      <i className="fa-solid fa-handshake-angle text-primary text-[11px]" />
                      <span className="font-bold">{ownPendingCredit.referadora_nombre}</span>
                    </p>
                  )}
                </div>
                <span className="text-[10px] font-bold text-primary bg-white px-2 py-0.5 rounded-full border border-primary/30">
                  <span>{ownPendingCredit.avales_actuales}/{ownPendingCredit.avales_minimos} avales</span>
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-white/60 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (ownPendingCredit.avales_actuales / ownPendingCredit.avales_minimos) * 100)}%` }}
                />
              </div>
              <p className="text-[9px] text-primary font-medium text-center">
                <span>
                  {ownPendingCredit.avales_actuales >= ownPendingCredit.avales_minimos
                    ? 'Tu crédito fue avalado y será procesado pronto.'
                    : `Esperando avales de tus compañeras (${ownPendingCredit.avales_minimos - ownPendingCredit.avales_actuales} faltante${ownPendingCredit.avales_minimos - ownPendingCredit.avales_actuales !== 1 ? 's' : ''})`}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Pending Avales Section */}
        {creditsToAval.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Créditos pendientes de avalar
            </h4>
            {creditsToAval.map((credito) => {
              const etiqueta = credito.mi_rol === 'lider' ? 'Avalar (2/2)' : 'Avalar (1/2)';
              return (
                <div
                  key={credito.id}
                  className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">
                        {credito.prestatario_nombre}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        ${Number(credito.monto).toLocaleString('es-CO')} COPm
                      </p>
                      {credito.descripcion && (
                        <p className="text-[10px] text-slate-400 italic">
                          {credito.descripcion}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-primary bg-surface px-2 py-0.5 rounded-full">
                      <span>{credito.avales_actuales}/2 avales</span>
                    </span>
                  </div>
                  {/* Circuito: referadora (1/2) → líder social (2/2) */}
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className={credito.aval_referadora_hecho ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                      <span>{credito.aval_referadora_hecho ? '✓' : '○'} Referadora</span>
                      {credito.referadora_nombre && (
                        <span className="font-normal text-slate-500"> ({credito.referadora_nombre})</span>
                      )}
                    </span>
                    <span className={credito.aval_lider_hecho ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                      <span>{credito.aval_lider_hecho ? '✓' : '○'} Líder Social</span>
                    </span>
                  </div>
                  {credito.ya_avale ? (
                    <div className="w-full py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 text-center">
                      ✓ Ya avalaste
                    </div>
                  ) : credito.puedo_avalar ? (
                    <button
                      onClick={() => handleAvalar(credito.id)}
                      disabled={loadingAval === credito.id}
                      className="w-full py-2 rounded-xl text-xs font-extrabold text-white bg-primary disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                    >
                      <span>{loadingAval === credito.id ? 'Avalando…' : etiqueta}</span>
                    </button>
                  ) : (
                    <div className="w-full py-2 rounded-xl text-[10px] font-bold text-slate-500 bg-slate-50 text-center">
                      <span>
                        {credito.mi_rol === 'lider' && !credito.aval_referadora_hecho
                          ? 'Esperando el aval de la referadora (1/2)'
                          : 'En proceso'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Members sections */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Miembros
          </h4>
          {members.map((member, index) => (
            <MemberCard key={index} member={member} />
          ))}
        </div>

      </div>

      {/* Footer */}
      <div className="pt-4">
        <p className="text-[9px] text-slate-300 text-center">
          Los puntajes son determinados por la comunidad GACC.
        </p>
      </div>
    </div>
  );
}
