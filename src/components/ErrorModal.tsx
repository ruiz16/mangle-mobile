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
}

export default function ErrorModal({ title, message, onClose }: ErrorModalProps) {
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

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-red-500 hover:bg-red-600 active:scale-[0.98] text-white font-extrabold text-sm rounded-2xl shadow-md transition-all"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
