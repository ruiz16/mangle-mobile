import { useEffect, useState } from 'react';
import { useAppState } from '../context/AppState';
import MemberCard from '../components/MemberCard';
import PageHeader from '../components/PageHeader';
import { showToast } from '../components/Toast';
import { apiGet, apiPost } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PendingAvalCredit {
  id: string;
  prestatario_id: string;
  prestatario_nombre: string;
  monto: string;
  descripcion: string | null;
  fecha_solicitud: string;
  avales_minimos: number;
  avales_actuales: number;
  ya_avale: boolean;
}

export default function Gacc() {
  const { state, setMunicipio, setGaccName, setGaccCode, setGaccMembers } = useAppState();
  const [pendingCredits, setPendingCredits] = useState<PendingAvalCredit[]>([]);
  const [loadingAval, setLoadingAval] = useState<string | null>(null); // credito_id being avalado

  // Fetch real GACC data from API on mount (non-blocking)
  useEffect(() => {
    if (!state.authToken) return;
    apiGet<{
      grupo: { id: number; nombre: string; codigo: string; municipio: string } | null;
      miembro: { id: number } | null;
      miembros: Array<{
        id: number;
        participante_id: number;
        validado_en: string | null;
        participante: { nombre: string; score_reputacion: number } | null;
      }>;
    }>('/api/gacc/mi-grupo', { token: state.authToken })
      .then((data) => {
        if (data?.grupo) {
          setGaccName(data.grupo.nombre);
          setGaccCode(data.grupo.codigo);
          if (data.grupo.municipio) setMunicipio(data.grupo.municipio as 'guapi' | 'timbiqui');
        }
        if (data?.miembros) {
          const selfId = data.miembro?.id ?? 0;
          const members = data.miembros.map((m) => ({
            id: String(m.id),
            participanteId: String(m.participante_id),
            name: m.participante?.nombre ?? '',
            role: '',
            status: m.validado_en ? 'Al día' as const : 'En Alerta' as const,
            score: m.participante?.score_reputacion ?? 50,
            validado: !!m.validado_en,
            self: m.id === selfId,
          }));
          setGaccMembers(members);
        }
      })
      .catch(() => {
        // API not available — use local state as fallback
      });
  }, [state.authToken, setMunicipio, setGaccName, setGaccCode, setGaccMembers]);

  // Fetch pending avales
  useEffect(() => {
    if (!state.authToken) return;
    apiGet<{ creditos: PendingAvalCredit[] }>('/api/gacc/pendientes-de-aval', {
      token: state.authToken,
    })
      .then((data) => {
        setPendingCredits(data?.creditos ?? []);
      })
      .catch(() => {
        setPendingCredits([]);
      });
  }, [state.authToken]);

  const gaccKey = state.municipio || '';
  const members = state.gaccMembers || [];
  const gaccCodeSafe = state.gaccCode || '—';
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
      await apiPost('/api/avales', { credito_id: creditoId }, { token: state.authToken });
      showToast('Aval Registrado', 'Has avalado este crédito con éxito.', 'success');
      // Remove from pending list and refresh
      setPendingCredits((prev) => prev.filter((c) => c.id !== creditoId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al avalar el crédito';
      showToast('Error', msg, 'error');
    } finally {
      setLoadingAval(null);
      // Refresh pending list
      try {
        const data = await apiGet<{ creditos: PendingAvalCredit[] }>(
          '/api/gacc/pendientes-de-aval',
          { token: state.authToken },
        );
        setPendingCredits(data?.creditos ?? []);
      } catch {
        // silent
      }
    }
  };

  const needsAval = pendingCredits.filter((c) => !c.ya_avale);

  return (
    <div className="flex-1 flex flex-col justify-between p-5">
      <div className="space-y-4">
        <PageHeader
          title="Mi Grupo GACC"
          subtitle="Ver y administrar tu grupo GACC."
          right={
            <span className="text-[9px] font-bold bg-[#2A5C3C] text-white px-2 py-0.5 rounded-full">
              {gaccKey.charAt(0).toUpperCase() + gaccKey.slice(1)}
            </span>
          }
        />

        {/* Community Alert */}
        {state.nodeAlert && (
          <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-[10px] text-rose-800 animate-pulse">
            <div className="flex gap-1.5 items-start">
              <i className="fa-solid fa-circle-exclamation text-xs mt-0.5" />
              <div>
                <strong className="font-bold block">Garantía Social Comprometida</strong>
                Tu compañera <span className="font-bold">{state.alertPartnerName}</span> presenta retraso. Tu red tiene 48h para apoyarla antes de suspender el nodo.
              </div>
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
              className="text-[9px] text-[#2A5C3C] underline cursor-pointer font-bold"
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
              {members.length} miembro{members.length !== 1 ? 's' : ''}
            </span>
          </div>
          <span className="text-sm font-bold text-slate-800">{state.gaccName}</span>
          <div className="flex gap-2">
            <span className="text-[10px] bg-[#1E3E28] text-white px-2 py-0.5 rounded-full font-bold">
              Score Promedio: {avgScore}
            </span>
          </div>
        </div>

        {/* Pending Avales Section */}
        {needsAval.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Créditos pendientes de avalar
            </h4>
            {needsAval.map((credito) => (
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
                  <span className="text-[10px] font-bold text-[#2A5C3C] bg-[#EBF4EE] px-2 py-0.5 rounded-full">
                    {credito.avales_actuales}/{credito.avales_minimos} avales
                  </span>
                </div>
                <button
                  onClick={() => handleAvalar(credito.id)}
                  disabled={loadingAval === credito.id}
                  className="w-full py-2 rounded-xl text-xs font-extrabold text-white bg-[#2A5C3C] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                >
                  {loadingAval === credito.id ? 'Avalando…' : 'Avalar crédito'}
                </button>
              </div>
            ))}
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
