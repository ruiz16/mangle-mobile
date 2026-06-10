import { useState, useEffect, useCallback } from 'react';
import { createPublicClient, http } from 'viem';
import { useAppState } from '../context/AppState';
import { useMiniPay } from '../hooks/useMiniPay';
import PageHeader from '../components/PageHeader';
import { showToast } from '../components/Toast';
import { getApiBase, getActiveChain, getActiveRpc } from '../lib/network';
import { formatCopm } from '../lib/currency';
import type { ApiCuota, PagoConfig } from '../types';
import type { Address } from 'viem';

// =============================================================================
// Repayment — COPm Payment Page
// =============================================================================
//
// Fetches real cuotas from GET /api/mis-cuotas, displays them grouped by
// credit, and allows paying each pending cuota with a real on-chain COPm
// transaction via MiniPay/MetaMask + POST /api/pago for backend registration.
// =============================================================================

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

interface CuotaGrouped {
  credito_id: string;
  descripcion: string | null;
  monto: string;
  totalCuotas: number;
  cuotas: ApiCuota[];
  estado: string;
}

function groupByCredit(cuotas: ApiCuota[]): CuotaGrouped[] {
  const map = new Map<string, CuotaGrouped>();
  for (const c of cuotas) {
    if (!map.has(c.credito_id)) {
      map.set(c.credito_id, {
        credito_id: c.credito_id,
        descripcion: c.credito_descripcion,
        monto: c.credito_monto,
        totalCuotas: c.total_cuotas,
        cuotas: [],
        estado: c.credito_estado,
      });
    }
    map.get(c.credito_id)!.cuotas.push(c);
  }
  return Array.from(map.values());
}

// ---- component ----

export default function Repayment() {
  const { state } = useAppState();
  const wallet = useMiniPay();

  const [cuotas, setCuotas] = useState<ApiCuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagoConfig, setPagoConfig] = useState<PagoConfig | null>(null);
  const [payingCuotaId, setPayingCuotaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API = getApiBase();
  const authToken = state.authToken;

  // ------------------------------------------------------------------
  // Fetch cuotas + pago config on mount
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!authToken) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        // Fetch cuotas and pago config in parallel
        const [cuotasRes, configRes] = await Promise.all([
          fetch(`${API}/api/mis-cuotas`, {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetch(`${API}/api/mobile/pago-config`),
        ]);

        if (!cuotasRes.ok) {
          throw new Error('Error al cargar cuotas');
        }

        const cuotasData: { cuotas: ApiCuota[] } = await cuotasRes.json();
        const configData: PagoConfig = await configRes.json();

        if (!cancelled) {
          setCuotas(cuotasData.cuotas);
          setPagoConfig(configData);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? 'Error de conexión');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [authToken, API]);

  // ------------------------------------------------------------------
  // Pay a cuota
  // ------------------------------------------------------------------
  const handlePay = useCallback(async (cuota: ApiCuota) => {
    if (payingCuotaId) return; // already paying one
    if (!pagoConfig) {
      showToast('Error', 'No se pudo obtener la configuración de pago', 'error');
      return;
    }
    if (!state.walletAddress) {
      showToast('Error', 'Conectá tu wallet primero', 'error');
      return;
    }

    setPayingCuotaId(cuota.id);

    try {
      // 1. Send COPm via wallet
      showToast('Enviando', 'Confirmá la transacción en tu wallet...', 'info');

      const txHash = await wallet.sendCopm(
        pagoConfig.platformWallet as Address,
        cuota.monto_cuota,
        state.walletAddress as Address,
      );

      showToast('Verificando', 'Transacción enviada. Esperando confirmación on-chain...', 'info');

      // 2. Wait for the transaction to be confirmed on-chain
      const publicClient = createPublicClient({
        chain: getActiveChain(),
        transport: http(getActiveRpc()),
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 60_000, // 60s max wait
      });

      if (receipt.status !== 'success') {
        throw new Error('La transacción fue revertida en la blockchain');
      }

      // 3. Register payment in backend
      const res = await fetch(`${API}/api/pago`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          cuota_id: cuota.id,
          tx_hash: txHash,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorCode = data.error as string;
        const detail = data.detail as string;

        const errorMessages: Record<string, string> = {
          TX_NO_ENCONTRADA: 'La transacción no se encontró en la blockchain',
          TX_REVERTIDA: 'La transacción fue revertida',
          TX_DESTINO_INVALIDO: 'Destino de transacción inválido',
          TX_BENEFICIARIO_INVALIDO: 'El beneficiario no coincide con la plataforma',
          TX_MONTO_INSUFICIENTE: 'El monto enviado es menor al valor de la cuota',
          YA_PAGADA: 'Esta cuota ya fue pagada',
          YA_PAGADO: 'El crédito ya fue pagado completamente',
          TX_HASH_DUPLICADO: 'Este hash ya fue registrado para otra cuota',
          NO_AUTENTICADO: 'Sesión expirada. Iniciá sesión de nuevo',
        };

        throw new Error(errorMessages[errorCode] ?? detail ?? 'Error al registrar pago');
      }

      // 4. Remove paid cuota from local list
      setCuotas((prev) => prev.filter((c) => c.id !== cuota.id));

      showToast(
        '¡Pago Exitoso!',
        `Cuota #${cuota.numero_cuota} pagada en la blockchain. Tx: ${txHash.slice(0, 10)}...`,
        'success',
      );
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Error al procesar el pago';
      showToast('Error', msg, 'error');
    } finally {
      setPayingCuotaId(null);
    }
  }, [payingCuotaId, pagoConfig, state.walletAddress, state.authToken, API, wallet, authToken]);

  // ------------------------------------------------------------------
  // Derived
  // ------------------------------------------------------------------
  const hasCredits = cuotas.length > 0;
  const grouped = groupByCredit(cuotas);

  // We need a connected wallet for payment
  const walletConnected = !!state.walletAddress;

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-5">
        <div className="text-center">
          <i className="fa-solid fa-spinner fa-spin text-emerald-600 text-xl mb-2" />
          <p className="text-xs text-slate-500">Cargando tus cuotas...</p>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Not logged in
  // ------------------------------------------------------------------
  if (!authToken) {
    return (
      <div className="flex-1 flex flex-col p-5">
        <PageHeader title="Repago de Crédito" subtitle="Ver y pagar tus cuotas." />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-xs">
            <i className="fa-solid fa-user-lock text-slate-300 text-3xl mb-3" />
            <p className="text-xs text-slate-500">
              Iniciá sesión con tu wallet para ver tus cuotas y pagar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Error loading
  // ------------------------------------------------------------------
  if (error && !hasCredits) {
    return (
      <div className="flex-1 flex flex-col p-5">
        <PageHeader title="Repago de Crédito" subtitle="Ver y pagar tus cuotas." />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-xs">
            <i className="fa-solid fa-circle-exclamation text-rose-400 text-3xl mb-3" />
            <p className="text-xs text-rose-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // No cuotas (no credits or all paid)
  // ------------------------------------------------------------------
  if (!hasCredits) {
    return (
      <div className="flex-1 flex flex-col p-5">
        <PageHeader
          title="Repago de Crédito"
          subtitle="Ver y pagar tus cuotas."
          right={
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${state.nodeAlert ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className={`text-[9px] font-bold ${state.nodeAlert ? 'text-rose-700 animate-pulse' : 'text-emerald-700'}`}>
                {state.nodeAlert ? 'Alerta Activa (48h)' : 'Nodo Al Día'}
              </span>
            </div>
          }
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-xs">
            <i className="fa-solid fa-circle-check text-emerald-300 text-3xl mb-3" />
            <p className="text-xs text-slate-500 font-medium">No tenés cuotas pendientes.</p>
            <p className="text-[10px] text-slate-400 mt-1">Todas tus cuotas están al día.</p>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Main render: cuotas grouped by credit
  // ------------------------------------------------------------------
  return (
    <div className="flex-1 flex flex-col justify-between p-5">
      <div className="space-y-4">
        <PageHeader
          title="Repago de Crédito"
          subtitle="Ver y pagar tus cuotas."
          right={
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${state.nodeAlert ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className={`text-[9px] font-bold ${state.nodeAlert ? 'text-rose-700 animate-pulse' : 'text-emerald-700'}`}>
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

        {/* Credit groups */}
        {grouped.map((group) => (
          <div key={group.credito_id}>
            {/* Credit summary card */}
            <div className="bg-gradient-to-br from-[#2A5C3C] to-[#1E3E28] text-white p-4 rounded-2xl shadow-sm space-y-3 relative overflow-hidden">
              <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-white/5" />

              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-emerald-200">
                    {group.descripcion ?? 'Ciclo de Crédito'}
                  </span>
                  <h4 className="text-2xl font-black mt-0.5">
                    {formatCopm(group.monto)} COPm
                  </h4>
                  <span className="text-[9px] text-emerald-300">
                    ~ {parseInt(group.monto).toLocaleString('es-CO')} COPm
                  </span>
                </div>
                <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded font-mono">
                  {group.estado === 'desembolsado' ? 'Activo' : group.estado}
                </span>
              </div>
            </div>

            {/* Cuotas list */}
            <div className="mt-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-3.5 py-2 border-b border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Cuotas ({group.cuotas.filter((c) => c.estado !== 'pagada').length} pendientes)
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {group.cuotas.map((cuota) => {
                  const isPending = cuota.estado === 'pendiente' || cuota.estado === 'vencida';
                  const isPastDue = cuota.estado === 'vencida';
                  const isPaid = cuota.estado === 'pagada';
                  const daysLeft = daysUntil(cuota.fecha_vencimiento);
                  const isPaying = payingCuotaId === cuota.id;

                  return (
                    <div key={cuota.id} className="px-3.5 py-3">
                      <div className="flex justify-between items-center">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700">
                              Cuota {cuota.numero_cuota} de {cuota.total_cuotas}
                            </span>
                            {isPaid ? (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <i className="fa-solid fa-circle-check" /> Pagada
                              </span>
                            ) : isPastDue ? (
                              <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                                Vencida
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400">
                                {daysLeft > 0 ? `En ${daysLeft} días` : 'Vence hoy'}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {formatCopm(cuota.monto_cuota)} COPm · Vence {formatDate(cuota.fecha_vencimiento)}
                          </p>
                        </div>

                        {isPending && (
                          <button
                            onClick={() => handlePay(cuota)}
                            disabled={isPaying}
                            className={`ml-2 px-3 py-2 rounded-xl text-[10px] font-extrabold transition flex items-center gap-1 ${
                              isPaying
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : isPastDue
                                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {isPaying ? (
                              <>
                                <i className="fa-solid fa-spinner fa-spin" /> Pagando
                              </>
                            ) : (
                              <>
                                <i className="fa-solid fa-money-bill-transfer" /> Pagar
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Show tx_hash if paid */}
                      {isPaid && cuota.tx_hash_pago && (
                        <p className="text-[8px] text-slate-400 mt-1 font-mono truncate">
                          Tx: {cuota.tx_hash_pago.slice(0, 16)}...
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Wallet connection warning */}
      {!walletConnected && hasCredits && (
        <div className="pt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <i className="fa-solid fa-plug text-amber-600 text-base block mb-1" />
            <p className="text-[11px] font-bold text-amber-800">Conectá tu Wallet</p>
            <p className="text-[10px] text-amber-600 mt-1">
              Necesitás conectar tu wallet para pagar cuotas en la blockchain.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
