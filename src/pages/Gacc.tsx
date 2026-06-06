import { useEffect } from 'react';
import { useAppState } from '../context/AppState';
import MemberCard from '../components/MemberCard';
import { showToast } from '../components/Toast';
import { apiGet } from '../lib/api';
import type { Member } from '../types';

export default function Gacc() {
  const { state, setGaccName, setGaccCode, setGaccMembers } = useAppState();

  // Fetch real GACC data from API on mount (non-blocking)
  useEffect(() => {
    if (!state.authToken) return;
    apiGet<{
      grupo: { id: number; nombre: string; codigo: string } | null;
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
  }, [state.authToken, setGaccName, setGaccCode, setGaccMembers]);

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

  return (
    <div className="flex-1 flex flex-col justify-between p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Mi Grupo GACC</h3>
          <span className="text-[9px] font-bold bg-[#2A5C3C] text-white px-2 py-0.5 rounded-full">
            {gaccKey.charAt(0).toUpperCase() + gaccKey.slice(1)}
          </span>
        </div>

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

        {/* Members sections */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Miembros
          </h4>
          {members.map((member, index) => (
            <MemberCard key={index} member={member} />
          ))}
        </div>

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
