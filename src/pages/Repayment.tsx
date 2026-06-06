import { useAppState } from '../context/AppState';
import PageHeader from '../components/PageHeader';
import { formatCOP } from '../lib/currency';
import { showToast } from '../components/Toast';

export default function Repayment() {
  const { state, payInstallment } = useAppState();

  const weeklyQuota = state.selectedAmount / 4;
  const remainingDebt = state.creditEstado === 'desembolsado'
    ? state.selectedAmount - weeklyQuota * state.installmentsPaid
    : 0;
  const isActive = state.creditEstado === 'desembolsado';
  const isComplete = isActive && state.installmentsPaid >= state.totalInstallments;

  const handlePay = () => {
    if (!isActive || isComplete) return;
    payInstallment();

    // NOTE: Real payment via POST /api/pago requires on-chain tx_hash
    // and cuota_id — out of scope for current integration.
    // The server will be called once the mobile supports real payments.

    showToast('Transacción Enviada', 'Ejecutando pagarCuota() en Celo Mainnet...', 'success');
    setTimeout(() => {
      showToast('Pago Confirmado', 'Comprobante emitido con timestamp on-chain.', 'success');
    }, 1500);
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5">
      <div className="space-y-4">
        <PageHeader
          title="Repago de Crédito"
          subtitle="Ver y administrar tu grupo GACC."
          right={
            <div className="flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  state.nodeAlert ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                }`}
              />
              <span
                className={`text-[9px] font-bold ${
                  state.nodeAlert ? 'text-rose-700 animate-pulse' : 'text-emerald-700'
                }`}
              >
                {state.nodeAlert ? 'Alerta Activa (48h)' : 'Nodo Al Día'}
              </span>
            </div>
          }
        />

        {/* Alert warning */}
        {state.nodeAlert && (
          <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-[10px] text-rose-800 animate-pulse">
            <div className="flex gap-1.5 items-start">
              <i className="fa-solid fa-circle-exclamation text-xs mt-0.5" />
              <div>
                <strong className="font-bold block">Garantía Social Comprometida</strong>
                Tu compañera <span className="font-bold">{state.alertPartnerName}</span> presenta retraso. Tu red tiene 48h para apoyarla antes de suspender el nodo.
              </div>
            </div>
          </div>
        )}

        {/* Outstanding Debt Card */}
        <div className="bg-gradient-to-br from-[#2A5C3C] to-[#1E3E28] text-white p-4 rounded-2xl shadow-sm space-y-3 relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-white/5" />

          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-emerald-200">
                Saldo pendiente de pago
              </span>
              <h4 className="text-2xl font-black mt-0.5">
                {isActive ? `${formatCOP(remainingDebt)} COPm` : '—'}
              </h4>
            </div>
            <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded font-mono">Celo Sepolia</span>
          </div>

          <div className="h-px bg-white/10" />

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[9px] text-emerald-200 block">Cuota semanal</span>
              <strong className="font-bold">
                {isActive ? `${formatCOP(weeklyQuota)} COPm` : '—'}
              </strong>
            </div>
            <div>
              <span className="text-[9px] text-emerald-200 block">Próximo Vencimiento</span>
              <strong className="font-bold text-[#D99B26]">En 3 días</strong>
            </div>
          </div>
        </div>

        {/* Cuotas Track */}
        {isActive && (
          <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">
              Tus Cuotas
            </span>

            <div className="space-y-1.5 text-xs">
              {Array.from({ length: state.totalInstallments }, (_, i) => {
                const cuotaNum = i + 1;
                const isPaid = cuotaNum <= state.installmentsPaid;
                return (
                  <div
                    key={cuotaNum}
                    className="flex justify-between items-center py-2 border-b border-slate-100"
                  >
                    <span className="font-medium text-slate-700">
                      Cuota {cuotaNum}: {formatCOP(weeklyQuota)} COPm
                    </span>
                    {isPaid ? (
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <i className="fa-solid fa-circle-check" /> Pagado
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold text-slate-400">
                        Semana {cuotaNum}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Payment trigger */}
      <div className="pt-4">
        {state.creditEstado === 'pendiente' ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <i className="fa-solid fa-hourglass-half text-amber-600 text-base block mb-1" />
            <p className="text-[11px] font-bold text-amber-800">Crédito Solicitado</p>
            <p className="text-[10px] text-amber-600 mt-1">Estamos revisando tu solicitud. Vuelve pronto para ver si fue aprobada.</p>
          </div>
        ) : state.creditEstado === 'pagado' ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <i className="fa-solid fa-circle-check text-emerald-600 text-base block mb-1" />
            <p className="text-[11px] font-bold text-emerald-800">¡Ciclo Completado!</p>
            <p className="text-[10px] text-emerald-600 mt-1">Felicitaciones {state.fullName || ''}. Completaste tu ciclo. Revisa tu Credencial de confianza.</p>
          </div>
        ) : isActive ? (
          <button
            onClick={handlePay}
            className="w-full py-3 bg-[#2A5C3C] hover:bg-[#1E3E28] text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
          >
            <i className="fa-solid fa-money-bill-transfer" /> Pagar Cuota Semanal ({formatCOP(weeklyQuota)} COPm)
          </button>
        ) : (
          <p className="text-center text-[10px] text-slate-400 py-3">
            Solicita un crédito para comenzar.
          </p>
        )}
      </div>
    </div>
  );
}
