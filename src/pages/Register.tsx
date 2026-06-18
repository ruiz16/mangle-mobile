import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useAppState } from '../context/AppState';
import { showToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import { apiGet, apiPost } from '../lib/api';
import { queryKeys } from '../queries/client';
import ErrorModal from '../components/ErrorModal';

export default function Register() {
  const { state, refreshTokens, registerUser } = useAppState();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Inputs del formulario — estado local (el perfil real vive en el backend).
  const [localName, setLocalName] = useState('');
  const [localEmail, setLocalEmail] = useState('');
  const [localPhone, setLocalPhone] = useState('');
  const [localOficio, setLocalOficio] = useState('');
  const [localCode, setLocalCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // ---- Validaciones ----
    if (!localName.trim()) {
      showToast('Faltan Campos', 'Por favor ingresa tu nombre.', 'warning');
      return;
    }
    if (!localEmail.trim()) {
      showToast('Faltan Campos', 'Por favor ingresa tu correo electrónico.', 'warning');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(localEmail.trim())) {
      showToast('Email Inválido', 'Por favor ingresa un correo electrónico válido.', 'warning');
      return;
    }
    if (!localPhone.trim()) {
      showToast('Faltan Campos', 'Por favor ingresa tu número de celular.', 'warning');
      return;
    }
    if (!localOficio.trim()) {
      showToast('Faltan Campos', 'Por favor ingresa tu oficio o rol ancestral.', 'warning');
      return;
    }

    if (!localCode.trim()) {
      showToast('Falta Código', 'Por favor ingresa un código de invitación.', 'warning');
      return;
    }

    setIsSubmitting(true);
    registerUser();

    // ---- Persistir en servidor (blocking) ----
    try {
      // 0. Validar que el GACC exista ANTES de crear el participante
      //    Evita dejar un participante huérfano si el código es inválido.
      await apiGet(
        `/api/gacc/validar-codigo?codigo=${encodeURIComponent(localCode.trim().toUpperCase())}`,
        { token: state.authToken, refreshToken: state.refreshToken, onTokenRefresh: refreshTokens },
      );

      // 1. Crear participante
      await apiPost('/api/participantes', {
        nombre: localName.trim(),
        email: localEmail.trim(),
        wallet_address: state.walletAddress,
        rol: 'usuario',
        oficio: localOficio.trim(),
        telefono: localPhone.trim(),
      }, { token: state.authToken, refreshToken: state.refreshToken, onTokenRefresh: refreshTokens });

      // 2. Unirse al GACC
      const unirseRes = await apiPost<{ es_lider?: boolean }>('/api/gacc/unirse', {
        codigo: localCode.trim().toUpperCase(),
      }, { token: state.authToken, refreshToken: state.refreshToken, onTokenRefresh: refreshTokens });
      
      if (unirseRes?.es_lider) {
        showToast('Eres Líder Social', 'Tu correo coincide con el del líder asignado: quedaste como Líder Social del GACC.', 'success');
      }
      
    } catch (err: any) {
      const msg = err?.message || err?.detail || 'Error al registrar en el servidor. Verificá tu conexión e intentá de nuevo.';
      setErrorModal({ title: 'Error de Registro', message: msg });
      return; // ❌ No navega — se queda en Register
    } finally {
      setIsSubmitting(false);
    }

    // Refrescar perfil/GACC desde el backend tras el registro.
    queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    queryClient.invalidateQueries({ queryKey: queryKeys.miGrupo });

    showToast('Registro Exitoso', 'Bienvenida a MANGLE.', 'success');
    setTimeout(() => navigate('/education'), 800);
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5">
      <div className="space-y-4">
        <PageHeader
          title="Registro del Perfil Emprendedor"
          subtitle="Tus datos personales para registro en la Fundación Libélulas Doradas."
          right={
            <span className="text-[10px] bg-amber-400 px-2 py-1.5 rounded-full text font-bold text-white uppercase tracking-wider">Paso Obligatorio</span>
          }
        />

        {/* Privacy */}
        <div className="bg-surface/50 p-3 rounded-xl border border-primary/10 flex gap-2">
          <i className="fa-solid fa-shield-halved text-primary text-xs mt-0.5" />
          <p className="text-[9px] text-ink leading-relaxed">
            Tus datos personales se almacenan de forma privada en la aplicación. En la blockchain solo queda registro de tu wallet y tus transacciones.
          </p>
        </div>

        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Nombre Completo</label>
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="Tu nombre completo"
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Correo Electrónico</label>
            <input
              type="email"
              value={localEmail}
              onChange={(e) => setLocalEmail(e.target.value)}
              placeholder="Tu correo electrónico"
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Role */}
          <div className="grid grid-cols-2 gap-2">
            <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Tu Oficio / Profesión</label>
            <input
              type="text"
              value={localOficio}
              onChange={(e) => setLocalOficio(e.target.value)}
              placeholder="Tu oficio o profesión"
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-primary focus:outline-none"
            />
            </div>

          {/* Phone */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Número de Celular</label>
              <input
                type="tel"
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value)}
                placeholder="Tu número de celular"
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Join mode fields */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Código de Invitación GACC</label>
            <input
              type="text"
              value={localCode}
              onChange={(e) => setLocalCode(e.target.value.toUpperCase())}
              placeholder="Tu código de invitación GACC (MANGLE-GUAPI)"
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none uppercase"
            />
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-3 bg-primary hover:bg-ink disabled:bg-primary/70 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
        >
          {isSubmitting ? (
            <>
              <i className="fa-solid fa-spinner animate-spin" />
              <span>Guardando perfil...</span>
            </>
          ) : (
            <>
              <span>Guardar Perfil y Continuar</span>
              <i className="fa-solid fa-arrow-right" />
            </>
          )}
        </button>
      </div>

      {errorModal && (
        <ErrorModal
          title={errorModal.title}
          message={errorModal.message}
          onClose={() => setErrorModal(null)}
        />
      )}
    </div>
  );
}
