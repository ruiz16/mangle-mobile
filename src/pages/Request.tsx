import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAppState } from '../context/AppState';
import AmountSlider from '../components/AmountSlider';
import PageHeader from '../components/PageHeader';
import { LOAN_CATEGORIES } from '../types';
import type { LoanCategory } from '../types';
import { showToast } from '../components/Toast';
import { apiPost } from '../lib/api';

export default function Request() {
  const { state, setSelectedAmount, setCategory, setTotalInstallments, submitLoan, refreshTokens } = useAppState();
  const [, navigate] = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [descripcion, setDescripcion] = useState('');

  const handleCategoryClick = (cat: LoanCategory) => {
    setCategory(cat);
  };

  // Redirect if education not complete
  useEffect(() => {
    if (state.eduProgress < 100) {
      showToast('Educación Incompleta', 'Completa el módulo educativo primero.');
      navigate('/education');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      await apiPost('/api/creditos', {
        monto: state.selectedAmount,
        uso: state.category,
        descripcion: descripcion || undefined,
        plazo_dias: state.totalInstallments * 7,
        numero_cuotas: state.totalInstallments,
      }, {
        token: state.authToken,
        refreshToken: state.refreshToken,
        onTokenRefresh: refreshTokens,
      });

      submitLoan();
      showToast('Solicitud Enviada', 'Tu crédito está en revisión.', 'success');
      navigate('/repayment');
    } catch (err: any) {
      const msg = err?.message ?? err?.detail ?? 'Error al enviar solicitud';
      showToast('Error', msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5">
      <div className="space-y-4">
        <PageHeader
          title="Solicitar tu Crédito"
          subtitle="Solicita tu crédito y recibe tu COPm en tu wallet."
        />

        {/* Slider + cuotas */}
        <AmountSlider
          value={state.selectedAmount}
          onChange={setSelectedAmount}
          installments={state.totalInstallments}
          onInstallmentsChange={setTotalInstallments}
        />

        {/* Dual-currency display */}
        {/* <div className="flex justify-between items-center bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
          <span className="text-[10px] font-medium text-slate-500">
            <i className="fa-solid fa-exchange-alt mr-1 text-[9px]" />
            Equivalente blockchain
          </span>
          <span className="text-xs font-bold text-slate-700">
            ≈ {formatCusd(cusdEquivalent)}
          </span>
        </div> */}

        {/* Category */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-900 block">¿En qué usarás tu crédito?</span>
          <div className="grid grid-cols-3 gap-2.5">
            {LOAN_CATEGORIES.map((cat) => {
              const isActive = state.category === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => handleCategoryClick(cat.key)}
                  className={`p-3 rounded-xl text-center flex  items-center justify-center gap-1.5 transition ${
                    isActive
                      ? 'border-2 border-[#2A5C3C]'
                      : 'border border-slate-100 opacity-60'
                  } bg-white`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${
                      isActive
                        ? 'bg-[#EBF4EE] text-[#2A5C3C]'
                        : 'bg-slate-50 text-slate-500'
                    }`}
                  >
                    <i className={`fa-solid fa-${cat.icon}`} />
                  </div>
                  <span
                    className={`text-[10px] ${
                      isActive ? 'font-bold text-slate-700' : 'font-medium text-slate-600'
                    }`}
                  >
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Descripción libre */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-900 block">
            Descripción <span className="text-[10px] font-normal text-slate-400">(opcional)</span>
          </span>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Describe tu solicitud. (opcional)"
            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:border-[#2A5C3C] transition"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="pt-3">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3.5 bg-[#2A5C3C] hover:bg-[#1E3E28] disabled:opacity-50 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all"
        >
          {submitting ? 'Procesando...' : 'Enviar Solicitud'}
        </button>
      </div>
    </div>
  );
}
