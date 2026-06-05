import { useEffect, useState } from 'react';

type ToastType = 'success' | 'warning';

interface ToastData {
  title: string;
  msg: string;
  type: ToastType;
}

const TOAST_EVENT = 'mangle:toast';
let toastId = 0;

/** Call from anywhere to show a toast — uses native DOM CustomEvent */
export function showToast(title: string, msg: string, type: ToastType = 'success') {
  console.log('[Toast] showToast called', { title, msg, type });
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { title, msg, type, id: ++toastId } }));
}

// Expose for manual browser console testing
if (typeof window !== 'undefined') {
  (window as any).__showToast = showToast;
}

export default function Toast() {
  const [data, setData] = useState<ToastData & { id: number } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    console.log('[Toast] Component mounted, registering event listener');

    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as ToastData & { id: number };
      console.log('[Toast] Event received', d);
      setData(d);
      setVisible(true);

      setTimeout(() => {
        console.log('[Toast] Hiding toast');
        setVisible(false);
      }, 3500);
    };

    window.addEventListener(TOAST_EVENT, handler);

    return () => {
      console.log('[Toast] Component unmounting, removing event listener');
      window.removeEventListener(TOAST_EVENT, handler);
    };
  }, []);

  // Always render the toast container — never return null.
  // When data is null or hidden, it stays invisible via opacity/translate.
  const isWarning = data?.type === 'warning';
  const bg = isWarning ? 'bg-amber-500' : 'bg-emerald-500';
  const icon = isWarning ? 'triangle-exclamation' : 'check';
  const show = visible && data !== null;

  return (
    <div
      className={`fixed bottom-20 right-1/2 translate-x-1/2 z-[9999] bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl border border-slate-800 max-w-xs w-full flex items-start gap-3 transition-all duration-300 ${
        show ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
      }`}
    >
      <div className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center text-slate-900 shrink-0`}>
        <i className={`fa-solid fa-${icon} text-sm`} />
      </div>
      <div>
        <span className="font-bold text-xs block">{data?.title ?? ''}</span>
        <p className="text-[11px] text-slate-300 mt-0.5">{data?.msg ?? ''}</p>
      </div>
    </div>
  );
}
