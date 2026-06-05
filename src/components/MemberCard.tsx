import type { Member } from '../types';

interface MemberCardProps {
  member: Member;
}

export default function MemberCard({ member }: MemberCardProps) {
  const isAlert = member.status === 'En Alerta';

  let statusBadge: string;
  if (isAlert) {
    statusBadge = 'bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-full text-[9px] animate-pulse';
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
              <span className="text-[8px] bg-[#2A5C3C]/10 text-[#2A5C3C] px-1 rounded">Tú</span>
            )}
          </span>
          <span className="text-[9px] text-slate-400 block">{member.role}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-mono font-bold text-slate-700">{member.score} pts</span>
        <span className={statusBadge}>{isAlert ? 'Alerta 48h' : 'Al día'}</span>
      </div>
    </div>
  );
}
