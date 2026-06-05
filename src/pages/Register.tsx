import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppState } from '../context/AppState';
import { REFERIDORAS_BY_GACC } from '../lib/data';
import { showToast } from '../components/Toast';
import type { Municipio } from '../types';

export default function Register() {
  const {
    state,
    setFullName,
    setRole,
    setPhone,
    setMunicipio,
    setReferidora,
    setGaccMode,
    setGaccCode,
    setGaccName,
    registerUser,
  } = useAppState();
  const [, navigate] = useLocation();

  const [localName, setLocalName] = useState(state.fullName);
  const [localPhone, setLocalPhone] = useState(state.phone);
  const [localCode, setLocalCode] = useState(state.gaccCode);
  const [localGaccName, setLocalGaccName] = useState(state.gaccName);

  const referidoras: string[] = REFERIDORAS_BY_GACC[state.municipio] ?? REFERIDORAS_BY_GACC.guapi ?? [];

  const handleMunicipioChange = (val: string) => {
    const m = val as Municipio;
    setMunicipio(m);
    setReferidora('');
  };

  const handleSubmit = () => {
    if (!localName.trim()) {
      showToast('Faltan Campos', 'Por favor ingresa tu nombre.', 'warning');
      return;
    }
    if (!localPhone.trim()) {
      showToast('Faltan Campos', 'Por favor ingresa tu número de celular.', 'warning');
      return;
    }

    setFullName(localName.trim());
    setPhone(localPhone.trim());

    if (state.gaccMode === 'join' && !localCode.trim()) {
      showToast('Falta Código', 'Por favor ingresa un código de invitación.', 'warning');
      return;
    }
    if (state.gaccMode === 'join') {
      setGaccCode(localCode.trim());
    } else {
      setGaccName(localGaccName.trim());
    }

    registerUser();
    showToast(
      state.gaccMode === 'join' ? 'Unión Exitosa' : 'GACC Creado',
      state.gaccMode === 'join' ? 'Unida al grupo exitosamente.' : 'GACC creado exitosamente.',
      'success',
    );

    setTimeout(() => navigate('/education'), 1200);
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5">
      <div className="space-y-4">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-[#D99B26] uppercase tracking-wider">Paso Obligatorio</span>
          <h3 className="text-base font-extrabold text-[#1E3E28]">Registro del Perfil Emprendedor</h3>
          <p className="text-[11px] text-slate-500">
            Tus datos de confianza se asocian de manera privada off-chain por la Fundación Libélulas Doradas.
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
              placeholder="Ej. Aura Cecilia Hinestroza"
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#2A5C3C] focus:outline-none"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Tu Oficio / Rol Ancestral</label>
            <select
              value={state.role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#2A5C3C] focus:outline-none"
            >
              <option value="Sabedora - Partera Tradicional">Sabedora - Partera Tradicional</option>
              <option value="Conchera de Piangua">Conchera de Piangua</option>
              <option value="Cocinera Tradicional">Cocinera Tradicional</option>
              <option value="Artesana de Paja Tetera">Artesana de Paja Tetera</option>
              <option value="Cacaotera de Guapi">Cacaotera de Guapi</option>
            </select>
          </div>

          {/* Phone + Municipio */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Número de Celular</label>
              <input
                type="tel"
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value)}
                placeholder="+57 3..."
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#2A5C3C] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Municipio / Territorio</label>
              <select
                value={state.municipio}
                onChange={(e) => handleMunicipioChange(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#2A5C3C] focus:outline-none"
              >
                <option value="guapi">Guapi</option>
                <option value="timbiqui">Timbiquí</option>
              </select>
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
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Código de Invitación GACC</label>
                <input
                  type="text"
                  value={localCode}
                  onChange={(e) => setLocalCode(e.target.value.toUpperCase())}
                  placeholder="Ej: GUAPI-101"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-[#2A5C3C] focus:outline-none uppercase"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Tu Referidora (Garantía Social)</label>
                <select
                  value={state.referidora}
                  onChange={(e) => setReferidora(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#2A5C3C] focus:outline-none"
                >
                  <option value="">Selecciona una referidora</option>
                  {referidoras.map((ref) => (
                    <option key={ref} value={ref}>{ref}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Create mode fields */}
          {state.gaccMode === 'create' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Nombre de tu nuevo GACC</label>
                <input
                  type="text"
                  value={localGaccName}
                  onChange={(e) => setLocalGaccName(e.target.value)}
                  placeholder="Ej. Semillas de Autonomía"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#2A5C3C] focus:outline-none"
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[9px] text-amber-950">
                <i className="fa-solid fa-triangle-exclamation mr-1" />
                Al crear el GACC, el sistema generará un <strong>Código de Invitación</strong> único para que puedas compartirlo de forma privada con tus compañeras.
              </div>
            </div>
          )}
        </div>

        {/* Privacy */}
        <div className="bg-[#EBF4EE]/50 p-3 rounded-xl border border-[#2A5C3C]/10 flex gap-2">
          <i className="fa-solid fa-shield-halved text-[#2A5C3C] text-xs mt-0.5" />
          <p className="text-[9px] text-[#1E3E28] leading-relaxed">
            <strong>FLD Privacidad:</strong> Tus datos personales NO se publican on-chain. Solo se valida el hash de tu credencial de confianza.
          </p>
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
