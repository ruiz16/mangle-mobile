import type { NavTab } from '../types';

interface BottomNavProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  alertDot?: boolean;
  eduComplete?: boolean;
}

const TABS: { key: NavTab; label: string; icon: string }[] = [
  { key: 'education', label: 'Educación', icon: 'graduation-cap' },
  { key: 'request', label: 'Solicitar', icon: 'hand-holding-dollar' },
  { key: 'gacc', label: 'Mi GACC', icon: 'users' },
  { key: 'repayment', label: 'Mi Crédito', icon: 'calendar-check' },
  { key: 'credential', label: 'Credencial', icon: 'id-card' },
];

export default function BottomNav({ activeTab, onNavigate, alertDot: _alertDot, eduComplete = true }: BottomNavProps) {
  return (
    <nav className="bg-white border-t border-slate-100 py-2 flex justify-around text-slate-400 z-40">
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            onClick={() => onNavigate(tab.key)}
            disabled={tab.key === 'request' && !eduComplete}
            className={`flex flex-col items-center gap-0.5 relative transition-all ${
              isActive
                ? 'text-primary font-bold scale-105'
                : tab.key === 'request' && !eduComplete
                  ? 'text-slate-300 opacity-40'
                  : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <i className={`fa-solid fa-${tab.icon} text-xs`} />
            <span className="text-[8px]">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
