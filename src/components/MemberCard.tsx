import type { Member } from '../types';

interface MemberCardProps {
  member: Member;
}

export default function MemberCard({ member }: MemberCardProps) {
  const isAlert = member.status === 'En Alerta';
  const isLider = member.role === 'Líder Social';

  let statusBadge: string;
  if (isAlert) {
    statusBadge = 'bg-danger-50 text-danger-700 font-bold px-2 py-0.5 rounded-full text-[9px] animate-pulse';
  } else {
    statusBadge = 'bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full text-[9px]';
  }

  return (
    <div className="p-2.5 bg-white rounded-xl border border-slate-100 flex justify-between items-center text-xs">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-sm font-bold">
          {member.name.charAt(0)}
        </div>
        <div>
          <span className="font-bold text-slate-800 flex items-center gap-1">
            {member.name}
            {member.self && (
              <span className="text-[8px] bg-primary/10 text-primary px-1 rounded">Tú</span>
            )}
          </span>
          {isLider ? (
            <span className="text-[8px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 mt-0.5">
              <i className="fa-solid fa-star text-[7px]" /> Líder Social
            </span>
          ) : (
            <span className="text-[9px] text-slate-400 block">{member.role}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-mono font-bold text-slate-700">{member.score} pts</span>
        <span className={statusBadge}>{isAlert ? 'Alerta 48h' : 'Al día'}</span>
      </div>
    </div>
  );
}
