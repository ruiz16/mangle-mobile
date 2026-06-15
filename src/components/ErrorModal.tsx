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
      <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Red header */}
        <div className="bg-red-500 px-6 pt-8 pb-6 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
            <i className="fa-solid fa-circle-exclamation text-white text-2xl" />
          </div>
          <h2 className="text-white text-base font-extrabold text-center leading-tight">
            {title}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5 text-center">
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        </div>

        {/* Action */}
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
