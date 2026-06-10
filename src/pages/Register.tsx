import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppState } from '../context/AppState';
import { showToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import type { Municipio } from '../types';
import { apiPost } from '../lib/api';

export default function Register() {
  const {
    state,
    setFullName,
    setEmail,
    setRole,
    setOficio,
    setPhone,
    setGaccMode,
    setGaccCode,
    setGaccName,
    registerUser,
  } = useAppState();
  const [, navigate] = useLocation();

  const [localName, setLocalName] = useState(state.fullName);
  const [localEmail, setLocalEmail] = useState(state.email);
  const [localPhone, setLocalPhone] = useState(state.phone);
  const [localCode, setLocalCode] = useState(state.gaccCode);
  const [localGaccName, setLocalGaccName] = useState(state.gaccName);
  const [localMunicipio, setLocalMunicipio] = useState<Municipio>(state.municipio);

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

    if (state.gaccMode === 'join' && !localCode.trim()) {
      showToast('Falta Código', 'Por favor ingresa un código de invitación.', 'warning');
      return;
    }

    // ---- Guardar en estado local ----
    setFullName(localName.trim());
    setEmail(localEmail.trim());
    setPhone(localPhone.trim());

    if (state.gaccMode === 'join') {
      setGaccCode(localCode.trim());
    } else {
      setGaccName(localGaccName.trim());
    }

    registerUser();

    // ---- Persistir en servidor (blocking) ----
    try {
      // 1. Crear participante
      await apiPost('/api/participantes', {
        nombre: localName.trim(),
        email: localEmail.trim(),
        wallet_address: state.walletAddress,
        rol: 'usuario',
        oficio: state.oficio.trim(),
        telefono: localPhone.trim(),
      }, { token: state.authToken });

      // 2. Crear o unirse al GACC
      if (state.gaccMode === 'create') {
        await apiPost('/api/gacc', {
          nombre: localGaccName.trim() || 'Mi GACC',
          municipio: localMunicipio,
        }, { token: state.authToken });
      } else if (localCode.trim()) {
        await apiPost('/api/gacc/unirse', {
          codigo: localCode.trim().toUpperCase(),
        }, { token: state.authToken });
      }
    } catch (err: any) {
      const msg = err?.message || err?.detail || 'Error al registrar en el servidor. Verificá tu conexión e intentá de nuevo.';
      showToast('Error de Registro', msg, 'error');
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
            Tus datos personales se almacenan de forma privada en la Fundación Libélulas Doradas. En la blockchain solo queda registro de tu wallet y tus transacciones.
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

          {/* GACC Access Mode */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-600 uppercase">Acceso a tu Grupo GACC</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGaccMode('join')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                  state.gaccMode === 'join'
                    ? 'border-2 border-[#2A5C3C] bg-[#EBF4EE]/30 text-[#1E3E28]'
                    : 'border border-slate-200 text-slate-500 font-semibold'
                }`}
              >
                <i className="fa-solid fa-key" /> Unirme con Código
              </button>
              <button
                type="button"
                onClick={() => setGaccMode('create')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                  state.gaccMode === 'create'
                    ? 'border-2 border-[#2A5C3C] bg-[#EBF4EE]/30 text-[#1E3E28]'
                    : 'border border-slate-200 text-slate-500 font-semibold'
                }`}
              >
                <i className="fa-solid fa-circle-plus" /> Crear Nuevo GACC
              </button>
            </div>
          </div>

              {/* Join mode fields */}
          {state.gaccMode === 'join' && (
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
          )}

          {/* Create mode fields */}
          {state.gaccMode === 'create' && (
            <div className='p-4 border border-[#2A5C3C]/10 rounded-xl bg-[#EBF4EE]/50'>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Nombre de tu nuevo GACC</label>
                  <input
                    type="text"
                    value={localGaccName}
                    onChange={(e) => setLocalGaccName(e.target.value)}
                    placeholder="Tu nombre de tu GACC"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#2A5C3C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Municipio / Territorio</label>
                  <select
                    value={localMunicipio}
                    onChange={(e) => setLocalMunicipio(e.target.value as Municipio)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#2A5C3C] focus:outline-none"
                  >
                    <option value="guapi">Guapi</option>
                    <option value="timbiqui">Timbiquí</option>
                  </select>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[9px] text-amber-950">
                  <i className="fa-solid fa-triangle-exclamation mr-1" />
                  Al crear el GACC, el sistema generará un <strong>Código de Invitación</strong> único para que puedas compartirlo de forma privada con tus compañeras.
                </div>
              </div>
            </div>
          )}
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
    </div>
  );
}
