import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAppState } from '../context/AppState';
import AmountSlider from '../components/AmountSlider';
import { LOAN_CATEGORIES } from '../types';
import type { LoanCategory } from '../types';
import { showToast } from '../components/Toast';
import { copmToCusd, formatCusd, getExchangeRate } from '../lib/currency';
import { apiPost } from '../lib/api';

export default function Request() {
  const { state, setSelectedAmount, setCategory, submitLoan, approveLoan } = useAppState();
  const [, navigate] = useLocation();
  const [submitting, setSubmitting] = useState(false);

  const cusdEquivalent = useMemo(
    () => copmToCusd(state.selectedAmount),
    [state.selectedAmount],
  );

  const handleCategoryClick = (cat: LoanCategory) => {
    setCategory(cat);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    submitLoan();

    // Create credit on server (non-blocking)
    if (state.authToken) {
      try {
        await apiPost('/api/creditos', {
          monto: state.selectedAmount,
          plazo_dias: state.totalInstallments * 7, // weekly installments
          numero_cuotas: state.totalInstallments,
          descripcion: state.category,
        }, { token: state.authToken });
      } catch {
        console.warn('[Request] API fallback to offline');
      }
    }

    showToast('Solicitud Enviada', 'Tu crédito está pendiente de aprobación...', 'success');

    // Simula el desembolso on-chain (en producción lo haría el admin/backend)
    setTimeout(() => {
      approveLoan();
      showToast('¡Crédito Desembolsado!', 'COPm transferido con éxito a tu wallet.', 'success');
      setSubmitting(false);
      navigate('/repayment');
    }, 2000);
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/education')}
          className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 border border-slate-100"
        >
          <i className="fa-solid fa-chevron-left text-xs" />
        </button>
        <h3 className="text-sm font-extrabold text-slate-800">Solicitar tu Crédito</h3>
      </div>

      <div className="space-y-4 mt-3">
        {/* Slider */}
        <AmountSlider value={state.selectedAmount} onChange={setSelectedAmount} />

        {/* Dual-currency display */}
        <div className="flex justify-between items-center bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
          <span className="text-[10px] font-medium text-slate-500">
            <i className="fa-solid fa-exchange-alt mr-1 text-[9px]" />
            Equivalente blockchain
          </span>
          <span className="text-xs font-bold text-slate-700">
            ≈ {formatCusd(cusdEquivalent)}
          </span>
        </div>

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
                  className={`p-3 rounded-xl text-center flex flex-col items-center justify-center gap-1.5 transition ${
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
