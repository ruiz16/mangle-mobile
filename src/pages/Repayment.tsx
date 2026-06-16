import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queries/client';
import { useCuotas, usePagoConfig } from '../queries/cuotas';
import { useCreditoActivo } from '../queries/creditos';
import { useMiAlerta, mensajeAlerta } from '../queries/gacc';
import { createPublicClient, keccak256, stringToHex } from 'viem';
import { useAppState } from '../context/AppState';
import { useMiniPay } from '../hooks/useMiniPay';
import PageHeader from '../components/PageHeader';
import { showToast } from '../components/Toast';
import { getActiveChain, getActiveTransport } from '../lib/network';
import { apiPost, ApiRequestError } from '../lib/api';
import { formatCopm } from '../lib/currency';
import Lottie from 'lottie-react';
import splashAnimation from '../assets/lottie/26187f5e-1174-11ee-993b-d7ded5bd38d2.json';
import walletAnimation from '../assets/lottie/16a8e6c0-117a-11ee-a9de-ab7b4c8f4c79.json';
import type { ApiCuota } from '../types';
import type { Address } from 'viem';

const PAGO_ERROR_MESSAGES: Record<string, string> = {
  TX_NO_ENCONTRADA: 'La transacción no se encontró en la blockchain',
  TX_REVERTIDA: 'La transacción fue revertida en la blockchain',
  TX_DESTINO_INVALIDO: 'Destino de transacción inválido',
  TX_BENEFICIARIO_INVALIDO: 'El beneficiario no coincide con la billetera de la fundación',
  TX_MONTO_INSUFICIENTE: 'El monto enviado es menor al valor de la cuota',
  YA_PAGADA: 'Esta cuota ya fue pagada',
  YA_PAGADO: 'El crédito ya fue pagado completamente',
  TX_HASH_DUPLICADO: 'Este hash ya fue registrado para otra cuota',
  NO_AUTENTICADO: 'Sesión expirada. Iniciá sesión de nuevo',
  ESTADO_INCORRECTO: 'La cuota no está en un estado pagable',
};

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
  referadoraNombre: string | null;
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
        referadoraNombre: c.credito_referadora_nombre,
        monto: c.credito_monto,
        totalCuotas: c.total_cuotas,
        cuotas: [],
        estado: c.credito_estado,
      });
    }
    map.get(c.credito_id)!.cuotas.push(c);
  }
  return Array.from(map.values()).sort((a, b) => {
    // Active credit always first
    if (a.estado === 'desembolsado') return -1;
    if (b.estado === 'desembolsado') return 1;
    return 0;
  });
}

// ---- CreditGroup sub-component ----

interface CreditGroupProps {
  group: CuotaGrouped;
  payingCuotaId: string | null;
  onPay: ((cuota: ApiCuota) => void) | null;
  isHistory: boolean;
}

function CreditGroup({ group, payingCuotaId, onPay, isHistory }: CreditGroupProps) {
  const pendingCount = group.cuotas.filter((c) => c.estado !== 'pagada').length;

  const headerLabel = () => {
    if (isHistory) return 'Pagado';
    if (group.estado === 'desembolsado') return 'Activo';
    return group.estado;
  };

  return (
    <div>
      {/* Credit summary card */}
      <div
        className={`text-white p-4 rounded-2xl shadow-sm space-y-3 relative overflow-hidden ${
          isHistory
            ? 'bg-gradient-to-br from-slate-500 to-slate-700'
            : 'bg-gradient-to-br from-primary to-ink'
        }`}
      >
        <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-white/5" />

        <div className="flex justify-between items-start">
          <div>
            <span className={`text-[9px] uppercase tracking-wider ${isHistory ? 'text-slate-300' : 'text-emerald-200'}`}>
              {group.descripcion ?? 'Ciclo de Crédito'}
            </span>
            <h4 className="text-2xl font-black mt-0.5">
              {formatCopm(group.monto)}
            </h4>
            <span className={`text-[9px] ${isHistory ? 'text-slate-300' : 'text-emerald-300'}`}>
              {(() => {
                const totalInteres = group.cuotas.reduce(
                  (sum, c) => sum + Number(c.monto_interes),
                  0,
                );
                return `+ ${formatCopm(totalInteres.toString())} intereses`;
              })()}
            </span>
          </div>
          <div className="flex flex-col items-end justify-between self-stretch text-right">
            <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded font-mono">
              {headerLabel()}
            </span>
            {group.referadoraNombre && (
              <span className={`text-[9px] inline-flex items-center gap-1 ${isHistory ? 'text-slate-300' : 'text-emerald-200'}`}>
                <i className="fa-solid fa-handshake-angle text-[10px]" />
                <span className="font-bold">{group.referadoraNombre}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cuotas list */}
      <div className="mt-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-3.5 py-2 border-b border-slate-100 flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {isHistory
              ? `${group.cuotas.length} cuotas — completado`
              : `Cuotas (${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''})`}
          </span>
          {isHistory && (
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <i className="fa-solid fa-circle-check" /> Saldado
            </span>
          )}
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
                        <span className="text-[9px] font-bold text-danger-600 bg-danger-50 px-2 py-0.5 rounded-full">
                          Vencida
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-400">
                          {daysLeft > 0 ? `En ${daysLeft} días` : 'Vence hoy'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {formatCopm(cuota.monto_cuota)} · Vence {formatDate(cuota.fecha_vencimiento)}
                    </p>
                  </div>

                  {isPending && !isHistory && onPay && (
                    <button
                      onClick={() => onPay(cuota)}
                      disabled={isPaying}
                      className={`ml-2 px-3 py-2 rounded-xl text-[10px] font-extrabold transition flex items-center gap-1 ${
                        isPaying
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : isPastDue
                            ? 'bg-danger-500 hover:bg-danger-600 text-white shadow-sm'
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

                {isPaid && cuota.tx_hash_pago && (
                  <p className="text-[8px] text-slate-400 mt-1 font-mono truncate">
                    Tx: {cuota.tx_hash_pago}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- component ----

export default function Repayment() {
  const { state, refreshTokens, showErrorModal } = useAppState();
  const miAlerta = useMiAlerta();
  const nodeAlerta = miAlerta.alerta;
  const queryClient = useQueryClient();
  useLocation();
  const wallet = useMiniPay();

  const [payingCuotaId, setPayingCuotaId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const lottieRef = useRef<null | { setSpeed: (s: number) => void }>(null);

  // Server-state vía TanStack Query (única fuente de verdad).
  const { data: cuotasData, isLoading: cuotasLoading, isError } = useCuotas();
  const { data: pagoConfig, isLoading: configLoading } = usePagoConfig();
  const { estado: creditEstado, isLoading: creditLoading } = useCreditoActivo();
  const cuotas = cuotasData?.cuotas ?? [];
  const error = isError ? 'No se pudo cargar tu información de pagos.' : null;

  // Speed 0.5 for the pending-credit Lottie (matches splash feel)
  useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.setSpeed(0.5);
    }
  });

  const authToken = state.authToken;

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
      showToast(
        'Enviando',
        cuota.credito_repayment_mode === 'pool'
          ? 'Confirmá DOS transacciones en tu wallet (autorización + pago).'
          : 'Confirmá la transacción en tu wallet.',
        'info',
      );

      let txHash: `0x${string}`;
      if (cuota.credito_repayment_mode === 'pool') {
        const creditId = keccak256(stringToHex(cuota.credito_id));
        txHash = await wallet.repayCopm(
          pagoConfig.lendingPoolAddress,
          creditId,
          cuota.monto_cuota,
          state.walletAddress as Address,
        );
      } else {
        txHash = await wallet.sendCopm(
          pagoConfig.platformWallet as Address,
          cuota.monto_cuota,
          state.walletAddress as Address,
        );
      }

      showToast('Verificando', 'Transacción enviada. Esperando confirmación on-chain.', 'info');

      // 2. Wait for the transaction to be confirmed on-chain
      const publicClient = createPublicClient({
        chain: getActiveChain(),
        transport: getActiveTransport(),
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 60_000, // 60s max wait
      });

      console.log('[Payment] Receipt: ', receipt);

      if (receipt.status !== 'success') {
        throw new Error('La transacción fue revertida en la blockchain, revisa que tengas suficiente saldo en tu wallet');
      }

      // 3. Register payment in backend
      await apiPost<{ status: string; cuota_id: string; credito_id: string }>(
        '/api/pago',
        { cuota_id: cuota.id, tx_hash: txHash },
        {
          token: authToken,
          refreshToken: state.refreshToken,
          onTokenRefresh: refreshTokens,
        },
      );

      // 4. Invalidar server-state: cuotas y estado del crédito se refrescan
      // solos (al pagar la última cuota → 'pagado'). Reemplaza el sync manual.
      queryClient.invalidateQueries({ queryKey: queryKeys.creditos });
      queryClient.invalidateQueries({ queryKey: queryKeys.cuotas });
      // 5. Refrescar el score (reputación) — se recalcula tras el pago.
      queryClient.invalidateQueries({ queryKey: queryKeys.score });

      showToast(
        '¡Pago Exitoso!',
        `Cuota #${cuota.numero_cuota} pagada en la blockchain. Tx: ${txHash.slice(0, 6)}}`,
        'success',
      );
    } catch (err: any) {
      const msg = err instanceof ApiRequestError
        ? (PAGO_ERROR_MESSAGES[err.code] ?? err.message)
        : (err?.shortMessage || err?.message || 'Error al procesar el pago');
      showErrorModal('Error en el pago', msg);
    } finally {
      setPayingCuotaId(null);
    }
  }, [payingCuotaId, pagoConfig, state.walletAddress, state.authToken, state.refreshToken, refreshTokens, wallet, authToken, queryClient]);

  // ------------------------------------------------------------------
  // Derived
  // ------------------------------------------------------------------
  const hasCredits = cuotas.length > 0;
  const grouped = groupByCredit(cuotas);
  const activeGroup = grouped.find((g) => g.estado === 'desembolsado') ?? null;
  const historicalGroups = grouped.filter((g) => g.estado !== 'desembolsado');

  // We need a connected wallet for payment
  const walletConnected = !!state.walletAddress;

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------
  const isLoading = cuotasLoading || configLoading || creditLoading;
  
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
            <i className="fa-solid fa-circle-exclamation text-danger-400 text-3xl mb-3" />
            <p className="text-xs text-danger-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Credit pending evaluation (no cuotas yet — waiting admin approval)
  // ------------------------------------------------------------------
  if (!isLoading && !hasCredits && creditEstado === 'pendiente') {
    return (
      <div className="flex-1 flex flex-col bg-gradient-to-b from-surface-light to-surface">
        <div className="px-5 pt-5">
          <PageHeader title="Repago de Crédito" subtitle="Estado de tu solicitud." />
        </div>
        <div className="flex-1 flex items-center justify-center p-6 -mt-10">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-ink/5 p-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="w-44 h-44">
                {/* @ts-ignore */}
                <Lottie lottieRef={lottieRef} animationData={splashAnimation} loop autoplay style={{ width: '100%', height: '100%' }} />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-extrabold text-ink leading-tight">Crédito en Evaluación</h2>
                <p className="text-sm text-slate-500 font-medium mt-2 leading-relaxed">
                  Tu solicitud está siendo revisada por el equipo MANGLE. Pronto recibirás notificación cuando sea aprobada y desembolsada.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // No cuotas (no credits or all paid)
  // ------------------------------------------------------------------
  if (!isLoading && !hasCredits) {
    return (
      <div className="flex-1 flex flex-col p-5">
        <PageHeader
          title="Repago de Crédito"
          subtitle="Ver y pagar tus cuotas."
          right={
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${nodeAlerta ? 'bg-danger-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className={`text-[9px] font-bold ${nodeAlerta ? 'text-danger-700 animate-pulse' : 'text-emerald-700'}`}>
                {nodeAlerta ? 'Alerta Activa (48h)' : 'Nodo Al Día'}
              </span>
            </div>
          }
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-xs flex flex-col items-center gap-3">
            <div className="w-40 h-40">
              {/* @ts-ignore */}
              <Lottie animationData={walletAnimation} loop autoplay style={{ width: '100%', height: '100%' }} />
            </div>
            <p className="text-xs text-slate-500 font-medium">No tenés cuotas pendientes.</p>
            <p className="text-[10px] text-slate-400 mt-1">Todas tus cuotas están al día.</p>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Main render: active credit + collapsible history
  // ------------------------------------------------------------------
  return (
    <div className="flex-1 flex flex-col justify-between p-5">
      <div className="space-y-4">
        <PageHeader
          title="Repago de Crédito"
          subtitle="Ver y pagar tus cuotas."
          right={
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${nodeAlerta ? 'bg-danger-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className={`text-[9px] font-bold ${nodeAlerta ? 'text-danger-700 animate-pulse' : 'text-emerald-700'}`}>
                {nodeAlerta ? 'Alerta Activa (48h)' : 'Nodo Al Día'}
              </span>
            </div>
          }
        />

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <i className="fa-solid fa-spinner fa-spin text-3xl text-primary" />
            <p className="text-xs text-slate-500">Cargando cuotas...</p>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Alert warning — personalizada por relación (privacidad) */}
            {miAlerta.alerta && (
              <div className="bg-danger-50 border border-danger-200 p-2.5 rounded-xl text-[10px] text-danger-800 animate-pulse">
                <div className="flex gap-1.5 items-start">
                  <i className="fa-solid fa-circle-exclamation text-xs mt-0.5" />
                  <div>
                    <strong className="font-bold block">Garantía Social Comprometida</strong>
                    {mensajeAlerta(miAlerta)}
                  </div>
                </div>
              </div>
            )}

            {/* ── Active credit ── */}
            {activeGroup && (
              <CreditGroup
                group={activeGroup}
                payingCuotaId={payingCuotaId}
                onPay={handlePay}
                isHistory={false}
              />
            )}

            {/* ── Historical credits ── */}
            {historicalGroups.length > 0 && (
              <div>
                <button
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-bold text-slate-500 uppercase tracking-wider transition hover:bg-slate-100"
                >
                  <span className="flex items-center gap-2">
                    <i className="fa-solid fa-clock-rotate-left" />
                    Historial de créditos ({historicalGroups.length})
                  </span>
                  <i className={`fa-solid fa-chevron-${historyOpen ? 'up' : 'down'} text-slate-400`} />
                </button>

                {historyOpen && (
                  <div className="mt-3 space-y-4">
                    {historicalGroups.map((group) => (
                      <CreditGroup
                        key={group.credito_id}
                        group={group}
                        payingCuotaId={null}
                        onPay={null}
                        isHistory
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Wallet connection warning */}
      {!isLoading && !walletConnected && hasCredits && (
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
