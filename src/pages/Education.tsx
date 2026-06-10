import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useAppState } from '../context/AppState';
import { apiGet, apiPost } from '../lib/api';
import type {
  ApiModuloEducativo,
  ApiModulosResponse,
  ApiEduProgresoResponse,
} from '../types';
import ChatBubble from '../components/ChatBubble';
import PageHeader from '../components/PageHeader';
import { showToast } from '../components/Toast';

export default function Education() {
  const { state, setEduProgress, refreshTokens } = useAppState();
  const [, navigate] = useLocation();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [modulos, setModulos] = useState<ApiModuloEducativo[]>([]);
  const [localStep, setLocalStep] = useState(state.currentEduStep);
  const [loading, setLoading] = useState(true);

  // ------------------------------------------------------------------
  // Fetch modules + progress on mount
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      // ---- 1. Modules (público) ----
      try {
        const modRes = await apiGet<ApiModulosResponse>(
          '/api/educacion/modulos',
        );
        if (cancelled) return;
        setModulos(modRes.modulos);
      } catch {
        // Módulos no disponibles — el empty state se encarga
      } finally {
        if (!cancelled) setLoading(false);
      }

      // ---- 2. Progreso (separado para que no bloquee módulos) ----
      try {
        const progRes = await apiGet<ApiEduProgresoResponse>(
          '/api/educacion/progreso',
          {
            token: state.authToken,
            refreshToken: state.refreshToken,
            onTokenRefresh: refreshTokens,
          },
        );
        if (cancelled) return;

        const total = progRes.progreso.modulos_totales || 1;
        const step = Math.min(progRes.progreso.modulo_actual, total);
        const progress = progRes.progreso.completado
          ? 100
          : Math.round((step / total) * 100);

        setLocalStep(step);
        setEduProgress(step, progress);
      } catch {
        // Progreso no disponible — mantener lo que venga de AppState
      }
    }

    load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — solo al montar

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
  const isComplete = state.eduProgress >= 100 || localStep > totalModulos;
  const progress = isComplete
    ? 100
    : Math.round((localStep / (totalModulos || 1)) * 100);

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
      const res = await apiPost<ApiEduProgresoResponse>(
        '/api/educacion/progreso',
        { modulo_actual: nextStep },
        {
          token: state.authToken,
          refreshToken: state.refreshToken,
          onTokenRefresh: refreshTokens,
        },
      );

      const completed = res.progreso.completado;
      const apiStep = res.progreso.modulo_actual;
      const total = res.progreso.modulos_totales || totalModulos;
      const apiProgress = completed ? 100 : Math.round((apiStep / total) * 100);

      // Sync AppState con la respuesta del servidor
      setEduProgress(apiStep, apiProgress);

      if (completed) {
        showToast(
          '¡Módulo Completado!',
          'Has habilitado la solicitud de microcrédito.',
        );
      }
    } catch {
      // Fallback: si falla el API, mantener el avance local
      const fallbackProgress = Math.round((nextStep / totalModulos) * 100);
      setEduProgress(
        Math.min(nextStep, totalModulos),
        Math.min(fallbackProgress, 100),
      );
    }
  };

  // ------------------------------------------------------------------
  // Loading skeleton
  // ------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-5">
        <div className="text-center space-y-3">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-[#2A5C3C]" />
          <p className="text-xs text-slate-500">Cargando módulos...</p>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Empty state
  // ------------------------------------------------------------------
  if (!hasModulos) {
    return (
      <div className="flex-1 flex flex-col justify-between p-5">
        <div className="space-y-4">
          <PageHeader
            title="Finanzas Cooperativas"
            subtitle="Completa tus saberes para liberar tu solicitud de microcrédito grupal."
          />
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center space-y-2">
            <i className="fa-solid fa-book-open text-3xl text-slate-300" />
            <p className="text-xs text-slate-500">
              No hay módulos disponibles por ahora.
            </p>
          </div>
        </div>
        <div className="pt-4">
          <button
            onClick={() => navigate('/request')}
            className="w-full py-3.5 bg-[#D99B26] hover:bg-amber-600 text-white font-extrabold text-sm rounded-xl shadow-md transition"
          >
            Ir a Solicitar Crédito
          </button>
        </div>
      </div>
    );
  }

  const visibleSteps = modulos.slice(0, localStep);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="flex-1 flex flex-col justify-between p-5">
      <div className="space-y-4">
        <PageHeader
          title="Finanzas Cooperativas"
          subtitle="Completa tus saberes para liberar tu solicitud de microcrédito grupal."
          right={
            <span className="text-xs font-mono text-slate-400">
              Paso {Math.min(localStep, totalModulos)} de {totalModulos}
            </span>
          }
        />

        <span className="block text-[11px] font-bold text-[#2A5C3C] bg-[#EBF4EE] px-2.5 py-1 rounded-full w-fit">
          <i className="fa-solid fa-graduation-cap" /> Módulo de Preparación
        </span>

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
              <ChatBubble key={i} sender={step.sender} msg={step.mensaje} />
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>
      </div>

      <div className="pt-4">
        {isComplete ? (
          <button
            onClick={() => navigate('/request')}
            className="w-full py-3.5 bg-[#D99B26] hover:bg-amber-600 text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            <span>Solicitar Crédito</span>{' '}
            <i className="fa-solid fa-circle-arrow-right" />
          </button>
        ) : (
          <button
            onClick={handleAdvance}
            className="w-full py-3 bg-[#2A5C3C] hover:bg-[#1E3E28] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            <span>Continuar Aprendizaje</span>{' '}
            <i className="fa-solid fa-arrow-right" />
          </button>
        )}
      </div>
    </div>
  );
}
