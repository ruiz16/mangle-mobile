import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import ChatBubble from '../components/ChatBubble';
import PageHeader from '../components/PageHeader';
import { showToast } from '../components/Toast';
import { useModulos, useEduProgreso, useAvanzarEducacion } from '../queries/educacion';

export default function Education() {
  const [, navigate] = useLocation();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Server-state vía TanStack Query.
  const { data: modulosData, isLoading: loading } = useModulos();
  const { step: serverStep, progress: serverProgress, completado } = useEduProgreso();
  const avanzar = useAvanzarEducacion();
  const modulos = modulosData?.modulos ?? [];

  // El paso visible del chat se controla localmente; se siembra del servidor.
  const [localStep, setLocalStep] = useState(1);
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && serverStep) {
      setLocalStep(serverStep);
      seeded.current = true;
    }
  }, [serverStep]);

  // ------------------------------------------------------------------
  // Auto-scroll al último mensaje
  // ------------------------------------------------------------------
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localStep]);

  // ------------------------------------------------------------------
  // Derived values
  // ------------------------------------------------------------------
  const totalModulos = modulos.length;
  const hasModulos = totalModulos > 0;
  const isComplete = completado || serverProgress >= 100 || localStep > totalModulos;
  const progress = isComplete ? 100 : Math.round((localStep / (totalModulos || 1)) * 100);

  // ------------------------------------------------------------------
  // Advance handler
  // ------------------------------------------------------------------
  const handleAdvance = async () => {
    if (!hasModulos) {
      // Sin datos locales, navegar igual
      navigate('/request');
      return;
    }

    if (localStep > totalModulos) {
      navigate('/request');
      return;
    }

    const nextStep = localStep + 1;

    // Avanzar localmente primero (UI responsive)
    setLocalStep(nextStep);

    try {
      // La mutación invalida ['edu-progreso'] y refresca el progreso real.
      const res = await avanzar.mutateAsync(nextStep);
      if (res.progreso.completado) {
        showToast(
          '¡Módulo Completado!',
          'Has habilitado la solicitud de microcrédito.',
        );
      }
    } catch {
      // Fallback: si falla el API, mantener el avance local optimista.
    }
  };

  // Si el progreso ya viene completado, mostrar todos los módulos (no recortar).
  const visibleSteps = isComplete ? modulos : modulos.slice(0, localStep);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="flex-1 flex flex-col justify-between p-5">
      <div className="space-y-4">
        <PageHeader
          title="Finanzas Cooperativas"
          subtitle="Completa tus saberes para liberar tu solicitud."
          right={
            <span className="text-xs font-mono text-slate-400">
              {loading
                ? 'Cargando...'
                : hasModulos
                  ? `Paso ${Math.min(localStep, totalModulos)} de ${totalModulos}`
                  : 'Sin módulos'}
            </span>
          }
        />

        <span className="block text-[11px] font-bold text-primary bg-surface px-2.5 py-1 rounded-full w-fit">
          <i className="fa-solid fa-graduation-cap" /> Módulo de Preparación
        </span>

        {/* Progress */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-700">
            <span>Tu Progreso Educativo</span>
            <span>{loading ? 0 : progress}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-500"
              style={{ width: `${loading ? 0 : progress}%` }}
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
            {loading ? (
              <div className="flex flex-col items-center justify-center py-6 space-y-3">
                <i className="fa-solid fa-spinner fa-spin text-2xl text-primary" />
                <p className="text-xs text-slate-500">Cargando módulos</p>
              </div>
            ) : !hasModulos ? (
              <div className="text-center py-6 space-y-2">
                <i className="fa-solid fa-book-open text-3xl text-slate-300" />
                <p className="text-xs text-slate-500">
                  No hay módulos disponibles por ahora.
                </p>
              </div>
            ) : (
              visibleSteps.map((step, i) => (
                <ChatBubble key={i} sender={step.sender} msg={step.mensaje} />
              ))
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      </div>

      <div className="pt-4">
        {loading ? (
          <button
            disabled
            className="w-full py-3 bg-slate-200 text-slate-400 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-spinner fa-spin" />
            <span>Cargando...</span>
          </button>
        ) : isComplete || !hasModulos ? (
          <button
            onClick={() => navigate('/request')}
            className="w-full py-3.5 bg-accent hover:bg-accent-dark text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            <span>{hasModulos ? 'Solicitar Crédito' : 'Ir a Solicitar Crédito'}</span>{' '}
            <i className="fa-solid fa-circle-arrow-right" />
          </button>
        ) : (
          <button
            onClick={handleAdvance}
            className="w-full py-3 bg-primary hover:bg-ink text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            <span>Continuar Aprendizaje</span>{' '}
            <i className="fa-solid fa-arrow-right" />
          </button>
        )}
      </div>
    </div>
  );
}
