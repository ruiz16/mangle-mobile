import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useAppState } from '../context/AppState';
import { EDU_CONVERSATION } from '../lib/data';
import ChatBubble from '../components/ChatBubble';
import { showToast } from '../components/Toast';

export default function Education() {
  const { state, advanceEdu } = useAppState();
  const [, navigate] = useLocation();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [localStep, setLocalStep] = useState(state.currentEduStep);

  const visibleSteps = EDU_CONVERSATION.slice(0, localStep);
  const isComplete = state.eduProgress >= 100;
  const progress = isComplete ? 100 : Math.round((localStep / EDU_CONVERSATION.length) * 100);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleSteps.length]);

  const handleAdvance = () => {
    if (localStep > EDU_CONVERSATION.length) {
      navigate('/request');
      return;
    }
    if (localStep === EDU_CONVERSATION.length) {
      setLocalStep((prev) => prev + 1);
      advanceEdu();
      setTimeout(() => showToast('¡Módulo Completado!', 'Has habilitado la solicitud de microcrédito.'), 300);
      return;
    }
    setLocalStep((prev) => prev + 1);
    advanceEdu();
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-bold text-[#2A5C3C] bg-[#EBF4EE] px-2.5 py-1 rounded-full">
            <i className="fa-solid fa-graduation-cap" /> Módulo de Preparación
          </span>
          <span className="text-xs font-mono text-slate-400">Paso {Math.min(localStep, EDU_CONVERSATION.length)} de {EDU_CONVERSATION.length}</span>
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-black text-[#1E3E28]">Finanzas Cooperativas</h3>
          <p className="text-[11px] text-slate-500">
            Completa tus saberes para liberar tu solicitud de microcrédito grupal.
          </p>
        </div>

        {/* Progress */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-700">
            <span>Tu Progreso Educativo</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#2A5C3C] h-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-400">
            <span>Semana 1: Onboarding</span>
            <span>Semana 2: Repago Social</span>
          </div>
        </div>

        {/* Chat */}
        <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm space-y-3">
          <span className="text-[10px] font-bold text-emerald-600 block">
            <i className="fa-brands fa-whatsapp" /> Chat de Aprendizaje FLD
          </span>

          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
            {visibleSteps.map((step, i) => (
              <ChatBubble key={i} sender={step.sender} msg={step.msg} />
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>
      </div>

      <div className="pt-4">
        {isComplete || localStep > EDU_CONVERSATION.length ? (
          <button
            onClick={() => navigate('/request')}
            className="w-full py-3.5 bg-[#D99B26] hover:bg-amber-600 text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            <span>Solicitar Crédito</span> <i className="fa-solid fa-circle-arrow-right" />
          </button>
        ) : (
          <button
            onClick={handleAdvance}
            className="w-full py-3 bg-[#2A5C3C] hover:bg-[#1E3E28] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            <span>Continuar Aprendizaje</span> <i className="fa-solid fa-arrow-right" />
          </button>
        )}
      </div>
    </div>
  );
}
