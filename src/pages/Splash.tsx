import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function Splash() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/connect'), 2200);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex-1 flex flex-col justify-between p-6 text-center">
      <div />

      <div className="flex flex-col items-center">
        {/* MANGLE Tree SVG */}
        <div className="w-44 h-44 mb-6 relative">
          <svg viewBox="0 0 100 100" className="w-full h-full text-[#2A5C3C]">
            <path d="M 50 55 C 45 65, 30 70, 20 85" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 50 55 C 50 68, 40 75, 45 90" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M 50 55 C 55 65, 70 70, 80 85" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 50 55 C 50 68, 60 75, 58 90" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M 46 55 L 48 30 L 52 30 L 54 55 Z" fill="currentColor" />
            <circle cx="50" cy="28" r="18" fill="none" stroke="currentColor" strokeWidth="4" />
            <circle cx="38" cy="35" r="12" fill="none" stroke="currentColor" strokeWidth="3" />
            <circle cx="62" cy="35" r="12" fill="none" stroke="currentColor" strokeWidth="3" />
            <path d="M 50 15 C 48 22, 52 22, 50 28" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M 38 28 C 34 32, 42 32, 38 42" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M 62 28 C 66 32, 58 32, 62 42" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center mt-12">
            <span className="text-[#1E3E28] font-extrabold text-2xl tracking-tight bg-[#FBF9F4] px-2 rounded-lg">MANGLE</span>
          </div>
        </div>
        <h2 className="text-2xl font-extrabold text-[#1E3E28] leading-tight">Bienvenida a MANGLE</h2>
        <p className="text-slate-500 text-xs mt-2 font-medium">Conectando tu billetera MiniPay...</p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-[#2A5C3C]/20 border-t-[#2A5C3C] rounded-full animate-spin" />
        <span className="text-[10px] text-slate-400 font-mono tracking-wider">Celo Mainnet Core v1.0.2</span>
      </div>
    </div>
  );
}
