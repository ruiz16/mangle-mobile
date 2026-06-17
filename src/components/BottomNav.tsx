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
  { key: 'repayment', label: 'Mi Crédito', icon: 'money-bill-wave' },
  { key: 'gacc', label: 'Mi GACC', icon: 'users' },
  { key: 'credential', label: 'Credencial', icon: 'id-card' },
];

export default function BottomNav({ activeTab, onNavigate, alertDot: _alertDot, eduComplete = true }: BottomNavProps) {
  return (
    <nav className="bg-primary border-t border-slate-100 py-2 flex justify-around text-slate-400 z-40">
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;

        if (tab.key === 'repayment') {
          return (
            <div key={tab.key} className="relative flex flex-col items-center -mt-6">
              <button
                onClick={() => onNavigate(tab.key)}
                className={`${isActive ? 'text-white font-bold' : 'text-white'} flex items-center justify-center w-14 h-12 rounded-t-full transition-all bg-primary scale-105`}
              >
                <i className={`fa-solid fa-${tab.icon} text-xl`} />
              </button>
              <span className={`text-[8px] z-10 ${isActive ? 'text-white font-bold' : 'text-white'} -mt-1.5`}>
                {tab.label}
              </span>
            </div>
          );
        }

        return (
          <button
            key={tab.key}
            onClick={() => onNavigate(tab.key)}
            disabled={tab.key === 'request' && !eduComplete}
            className={`flex flex-col items-center gap-0.5 relative transition-all ${
              isActive
                ? 'text-white font-bold scale-105'
                : tab.key === 'request' && !eduComplete
                  ? 'text-white opacity-40'
                  : 'text-white hover:text-white'
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
