import { useEffect, useState, useCallback } from 'react';

type ToastType = 'success' | 'warning';

interface ToastData {
  title: string;
  msg: string;
  type: ToastType;
}

let showToastFn: ((data: ToastData) => void) | null = null;

/** Call from anywhere to show a toast */
export function showToast(title: string, msg: string, type: ToastType = 'success') {
  showToastFn?.({ title, msg, type });
}

export default function Toast() {
  const [data, setData] = useState<ToastData | null>(null);
  const [visible, setVisible] = useState(false);

  const show = useCallback((d: ToastData) => {
    setData(d);
    setVisible(true);
    setTimeout(() => setVisible(false), 3000);
  }, []);

  useEffect(() => {
    showToastFn = show;
    return () => { showToastFn = null; };
  }, [show]);

  if (!data) return null;

  const isWarning = data.type === 'warning';
  const bg = isWarning ? 'bg-amber-500' : 'bg-emerald-500';
  const icon = isWarning ? 'triangle-exclamation' : 'check';

  return (
    <div
      className={`fixed bottom-20 right-4 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl border border-slate-800 max-w-sm flex items-start gap-3 transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0'
      }`}
    >
      <div className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center text-slate-900 shrink-0`}>
        <i className={`fa-solid fa-${icon} text-sm`} />
      </div>
      <div>
        <span className="font-bold text-xs block">{data.title}</span>
        <p className="text-[11px] text-slate-300 mt-0.5">{data.msg}</p>
      </div>
    </div>
  );
}
