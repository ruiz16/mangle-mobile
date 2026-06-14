import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppState } from '../context/AppState';
import { showToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import { apiGet, apiPost } from '../lib/api';
import ErrorModal from '../components/ErrorModal';

export default function Register() {
  const {
    state,
    refreshTokens,
    setFullName,
    setEmail,
    setOficio,
    setPhone,
    setGaccCode,
    registerUser,
  } = useAppState();
  const [, navigate] = useLocation();

  const [localName, setLocalName] = useState(state.fullName);
  const [localEmail, setLocalEmail] = useState(state.email);
  const [localPhone, setLocalPhone] = useState(state.phone);
  const [localCode, setLocalCode] = useState(state.gaccCode);

  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);

  const handleSubmit = async () => {
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
    if (!state.oficio.trim()) {
      showToast('Faltan Campos', 'Por favor ingresa tu oficio o rol ancestral.', 'warning');
      return;
    }

    if (!localCode.trim()) {
      showToast('Falta Código', 'Por favor ingresa un código de invitación.', 'warning');
      return;
    }

    // ---- Guardar en estado local ----
    setFullName(localName.trim());
    setEmail(localEmail.trim());
    setPhone(localPhone.trim());
    setGaccCode(localCode.trim());

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
        oficio: state.oficio.trim(),
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
    }

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
            <span className="text-[10px] bg-amber-400 px-2 py-1.5 rounded-full text font-bold text-[#fff] uppercase tracking-wider">Paso Obligatorio</span>
          }
        />

        {/* Privacy */}
        <div className="bg-[#EBF4EE]/50 p-3 rounded-xl border border-[#2A5C3C]/10 flex gap-2">
          <i className="fa-solid fa-shield-halved text-[#2A5C3C] text-xs mt-0.5" />
          <p className="text-[9px] text-[#1E3E28] leading-relaxed">
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
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#2A5C3C] focus:outline-none"
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
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#2A5C3C] focus:outline-none"
            />
          </div>

          {/* Role */}
          <div className="grid grid-cols-2 gap-2">
            <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Tu Oficio / Profesión</label>
            <input
              type="text"
              value={state.oficio}
              onChange={(e) => setOficio(e.target.value)}
              placeholder="Tu oficio o profesión"
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#2A5C3C] focus:outline-none"
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
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#2A5C3C] focus:outline-none"
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
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-[#2A5C3C] focus:outline-none uppercase"
            />
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button
          onClick={handleSubmit}
          className="w-full py-3 bg-[#2A5C3C] hover:bg-[#1E3E28] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
        >
          <span>Guardar Perfil y Continuar</span> <i className="fa-solid fa-arrow-right" />
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
