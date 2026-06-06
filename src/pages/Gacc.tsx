import { useEffect } from 'react';
import { useAppState } from '../context/AppState';
import MemberCard from '../components/MemberCard';
import { showToast } from '../components/Toast';
import { apiGet } from '../lib/api';
import type { Member } from '../types';

export default function Gacc() {
  const { state, setGaccName, setGaccCode, restoreNodeAlert } = useAppState();

  // Fetch real GACC data from API on mount (non-blocking)
  useEffect(() => {
    if (!state.authToken) return;
    apiGet<{
      grupo: { id: number; nombre: string; codigo_invitacion: string } | null;
      miembros: unknown[];
    }>('/api/gacc/mi-grupo', { token: state.authToken })
      .then((data) => {
        if (data?.grupo) {
          setGaccName(data.grupo.nombre);
          setGaccCode(data.grupo.codigo_invitacion);
        }
        // NOTE: miembros from API has different schema than Member[]
        // Members are maintained from local state after registration.
        // Full API-driven member sync is future work.
      })
      .catch(() => {
        // API not available — use local state as fallback
      });
  }, [state.authToken, setGaccName, setGaccCode]);

  const gaccKey = state.municipio;
  const members = state.gaccMembers;
  const avgScore =
    members.length > 0
      ? Math.round(members.reduce((sum, m) => sum + m.score, 0) / members.length)
      : 0;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(state.gaccCode);
    showToast('Código Copiado', `Comparte el código ${state.gaccCode} con tus compañeras.`, 'success');
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
            {state.gaccCode}
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
        {restoreNodeAlert && (
          <button
            className="w-full bg-amber-100 border border-amber-300 rounded-2xl p-3 space-y-1"
            onClick={() => {
              showToast(
                'Restore Node',
                `Correo temporal: ${state.phone}@mangle.com | Contraseña: mangle${state.gaccCode}`,
                'success',
              );
            }}
          >
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
              Nodo Comunidad GACC
            </span>
            <p className="text-[11px] text-amber-800 text-left">
              Se detectó una alerta de nodo comunitario. Haz clic para ver los datos de acceso del
              Restore Node.
            </p>
          </button>
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
