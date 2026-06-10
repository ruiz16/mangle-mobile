import { formatCOP } from '../lib/currency';

interface AmountSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  installments: number;
  onInstallmentsChange: (n: number) => void;
}

export default function AmountSlider({
  value,
  onChange,
  min = 20000,
  max = 200000,
  step = 10000,
  installments,
  onInstallmentsChange,
}: AmountSliderProps) {
  const quota = value / installments;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5 space-y-3">
      <span className="text-xs font-bold text-slate-900 block">
        <i className="fa-solid fa-coins text-[#D99B26] mr-1.5" />¿Cuánto crédito necesitas?
      </span>

      <div className="text-center py-2">
        <span className="inline-block bg-[#EBF4EE] text-[#2A5C3C] text-2xl font-black px-5 py-2 rounded-xl">{formatCOP(value)} COP</span>
      </div>

      <div className="relative pt-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#2A5C3C]"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-bold mt-2">
          <span>Min: {formatCOP(min)} COP</span>
          <span>Max: {formatCOP(max)} COP</span>
        </div>
      </div>

      {/* Cuotas selector */}
      <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-100 shadow-sm">
        <span className="text-[10px] font-bold text-slate-700">N° de Cuotas</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onInstallmentsChange(Math.max(1, installments - 1))}
            disabled={installments <= 1}
            className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold disabled:opacity-30"
          >−</button>
          <span className="text-sm font-black text-[#2A5C3C] w-6 text-center">{installments}</span>
          <button
            type="button"
            onClick={() => onInstallmentsChange(Math.min(24, installments + 1))}
            disabled={installments >= 24}
            className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold disabled:opacity-30"
          >+</button>
        </div>
      </div>

      {/* Terms — texto sutil */}
      <p className="text-[10px] text-slate-400 text-center leading-relaxed">
        Pagas en <span className="font-medium text-slate-500">{installments} cuota{installments !== 1 ? 's' : ''} semanales</span> de{' '}
        <span className="font-medium text-slate-500">{formatCOP(quota)} COP</span> cada una.
      </p>
    </div>
  );
}
