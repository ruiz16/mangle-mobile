import { useLocation } from 'wouter';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  right?: ReactNode;
}

export default function PageHeader({ title, subtitle, backTo, right }: PageHeaderProps) {
  const [, navigate] = useLocation();

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 border border-slate-100 shrink-0 transition"
          >
            <i className="fa-solid fa-chevron-left text-xs" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-sm font-extrabold text-[#1E3E28] truncate">{title}</h1>
          {subtitle && (
            <p className="text-[10px] text-slate-500 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}
