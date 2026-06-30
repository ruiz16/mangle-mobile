// =============================================================================
// ErrorModal — Blocking error overlay
//
// Renders a fullscreen modal for critical errors (connection failure, rejected
// payment, wallet link failure). Blocks interaction until the user taps Accept.
// Cannot be dismissed by tapping the backdrop.
// =============================================================================

interface ErrorModalProps {
  title: string;
  message: string;
  onClose: () => void;
  /** Botón de acción opcional (ej. deep-link de depósito MiniPay). */
  action?: { label: string; href: string };
}

export default function ErrorModal({ title, message, onClose, action }: ErrorModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl">
        <div className="px-6 pt-6 pb-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 rounded-full bg-red-100 flex items-center justify-center">
              <i className="fa-solid fa-circle-exclamation text-red-500 text-lg" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-ink leading-tight">
                {title}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-2.5">
          {action && (
            <a
              href={action.href}
              onClick={onClose}
              className="block w-full py-3.5 bg-primary active:scale-[0.98] text-white font-extrabold text-sm rounded-2xl shadow-md transition-all text-center"
            >
              {action.label}
            </a>
          )}
          <button
            onClick={onClose}
            className={`w-full py-3.5 active:scale-[0.98] font-extrabold text-sm rounded-2xl transition-all ${
              action
                ? 'bg-slate-100 text-slate-600'
                : 'bg-red-500 hover:bg-red-600 text-white shadow-md'
            }`}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
