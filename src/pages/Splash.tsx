import { useEffect } from 'react';
import { useLocation } from 'wouter';
import logo from '../assets/images/Logo_Mangle.png';
import { mangleStorage } from '../lib/storage';

export default function Splash() {
  const [, navigate] = useLocation();

  useEffect(() => {
    // Si viene con ?reset=1 limpiar storage y forzar login fresco
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === '1') {
      mangleStorage.removeItem('mangle:state');
    }
    const timer = setTimeout(() => navigate('/connect'), 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-surface-light to-surface p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-ink/5 p-8 space-y-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-44 h-auto">
            <img src={logo} alt="logo" />
          </div>
          <h2 className="text-xl font-extrabold font-display text-ink leading-tight">Bienvenid@ a MANGLE</h2>
          <p className="text-sm text-slate-500 font-medium">¡Conectando tu billetera!</p>
        </div>
        <div className="flex flex-col items-center gap-4">
          <span className="bg-surface-light border border-primary/10 px-4 py-1.5 rounded-full text-[11px] font-mono text-primary font-medium tracking-wider">
            MANGLE Colombia
          </span>
        </div>
      </div>
    </div>
  );
}
