import { useAppState } from '../context/AppState';
import MemberCard from '../components/MemberCard';
import { showToast } from '../components/Toast';

export default function Gacc() {
  const { state, restoreNodeAlert } = useAppState();

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
            <span className="text-[8px] bg-[#EBF4EE] text-[#2A5C3C] px-1.5 py-0.5 rounded font-bold">
              Garantía Activa
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-xs font-bold text-slate-700 flex items-center justify-between">
              {state.gaccCode || '—'}
            </div>
            <button
              onClick={handleCopyCode}
              className="px-3 bg-[#EBF4EE] hover:bg-[#2A5C3C]/20 text-[#2A5C3C] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shrink-0"
            >
              <i className="fa-regular fa-copy" /> Copiar
            </button>
          </div>
          <p className="text-[8.5px] text-slate-500 leading-snug">
            Comparte este código con tus compañeras de confianza para sumarlas a tu red de apoyo mutuo.
          </p>
        </div>

        {/* Score Overview */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[9px] text-slate-400 block uppercase">Reputación Grupal</span>
            <span className="text-xl font-bold text-[#1E3E28]">{avgScore}% Confianza</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#EBF4EE] text-[#2A5C3C] flex items-center justify-center text-lg">
            <i className="fa-solid fa-users" />
          </div>
        </div>

        {/* Active alert */}
        {state.nodeAlert && (
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-xs space-y-2">
            <div className="flex gap-2 items-start text-amber-900">
              <i className="fa-solid fa-triangle-exclamation text-sm mt-0.5" />
              <p className="text-[10px] leading-snug">
                <strong>¡Respaldo Activado!</strong> Una compañera de tu nodo presenta un retraso de pago. Apóyala para evitar la suspensión grupal de créditos.
              </p>
            </div>
            <button
              onClick={restoreNodeAlert}
              className="w-full py-1.5 bg-[#D99B26] text-white font-bold text-[10px] rounded-lg shadow-sm hover:bg-yellow-600 transition flex items-center justify-center gap-1"
            >
              <i className="fa-solid fa-hand-holding-heart" /> Aportar $25.000 COPm de Soporte
            </button>
          </div>
        )}

        {/* Members list */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">
            Integrantes del GACC
          </span>
          <div className="space-y-2">
            {members.length > 0 ? (
              members.map((member, i) => (
                <MemberCard key={i} member={member} />
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">
                No hay integrantes en tu GACC aún.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Info footer */}
      <div className="bg-[#EBF4EE]/40 p-2.5 rounded-xl text-[9px] text-[#1E3E28] flex items-start gap-1.5 mt-4">
        <i className="fa-solid fa-circle-info mt-0.5 text-[#2A5C3C]" />
        <span>
          La Garantía Social incentiva el apoyo grupal: un récord 100% puntual beneficia las próximas líneas de crédito de todas.
        </span>
      </div>
    </div>
  );
}
