import { useEffect } from 'react';
import { useLocation } from 'wouter';
import Lottie from 'lottie-react';
import splashAnimation from '../assets/lottie/26187f5e-1174-11ee-993b-d7ded5bd38d2.json';

export default function Splash() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/connect'), 2200);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-[#F0F7F3] to-[#E8F0EC] p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-green-900/5 p-8 space-y-6">

        {/* Lottie animation */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-44 h-44">
            <Lottie
              animationData={splashAnimation}
              loop
              autoplay
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <h2 className="text-xl font-extrabold text-[#1E3E28] leading-tight">Bienvenid@ a MANGLE</h2>
          <p className="text-sm text-slate-500 font-medium">¡Conectando tu billetera!</p>
        </div>

        {/* Spinner + Network badge */}
        <div className="flex flex-col items-center gap-4">
          {/* <div className="w-10 h-10 border-4 border-[#2A5C3C]/20 border-t-[#2A5C3C] rounded-full animate-spin" /> */}
          <span className="bg-[#F0F7F3] border border-[#2A5C3C]/10 px-4 py-1.5 rounded-full text-[11px] font-mono text-[#2A5C3C] font-medium tracking-wider">
            CELO COLOMBIA
          </span>
        </div>

      </div>
    </div>
  );
}
