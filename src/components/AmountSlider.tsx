import { formatCOP } from '../lib/currency';

interface AmountSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export default function AmountSlider({
  value,
  onChange,
  min = 20000,
  max = 200000,
  step = 10000,
}: AmountSliderProps) {
  const quota = value / 4;

  return (
    <div className="space-y-3">
      <span className="text-xs font-bold text-slate-900 block">¿Cuánto crédito necesitas?</span>

      <div className="text-center py-2">
        <span className="text-3xl font-black text-[#2A5C3C]">{formatCOP(value)} COP</span>
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

      <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
        <div className="bg-[#2A5C3C]/10 text-[#2A5C3C] px-4 py-2 text-[10px] font-bold flex items-center gap-1.5 border-b border-[#2A5C3C]/10">
          <i className="fa-solid fa-shield-check" /> Términos y Condiciones
        </div>
        <div className="p-4 flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
            <i className="fa-solid fa-check text-xs" />
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Pagas en <span className="font-bold text-slate-800">4 cuotas semanales</span> de{' '}
            <span className="font-bold text-slate-800">{formatCOP(quota)} COP</span> (incluye tarifa de servicio Web3). Sin intereses ocultos.
          </p>
        </div>
      </div>
    </div>
  );
}
