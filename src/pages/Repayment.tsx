import { useState, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queries/client';
import { useCuotas, usePagoConfig } from '../queries/cuotas';
import { useCreditoActivo } from '../queries/creditos';
import { useMiAlerta, mensajeAlerta, usePendientesAval } from '../queries/gacc';
import { createPublicClient, keccak256, stringToHex } from 'viem';
import { useAppState } from '../context/AppState';
import { useMiniPay } from '../hooks/useMiniPay';
import PageHeader from '../components/PageHeader';
import { showToast } from '../components/Toast';
import { getActiveChain, getActiveTransport } from '../lib/network';
import { apiPost, ApiRequestError } from '../lib/api';
import { formatCopm } from '../lib/currency';
import Lottie from 'lottie-react';
import walletAnimation from '../assets/lottie/16a8e6c0-117a-11ee-a9de-ab7b4c8f4c79.json';
import logoMangle from '../assets/images/Logo_Mangle.png';
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

const PENDING_TX_PREFIX = 'mangle:pendingPagoTx:';
function getPendingTx(cuotaId: string) {
  try { const v = localStorage.getItem(PENDING_TX_PREFIX + cuotaId); return v && /^0x[a-fA-F0-9]{64}$/.test(v) ? (v as `0x${string}`) : null; } catch { return null; }
}
function setPendingTx(cuotaId: string, txHash: string) {
  try { localStorage.setItem(PENDING_TX_PREFIX + cuotaId, txHash); } catch { /* noop */ }
}
function clearPendingTx(cuotaId: string) {
  try { localStorage.removeItem(PENDING_TX_PREFIX + cuotaId); } catch { /* noop */ }
}
function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; }
}
function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

interface CuotaGrouped {
  credito_id: string; descripcion: string | null; referadoraNombre: string | null;
  monto: string; totalCuotas: number; cuotas: ApiCuota[]; estado: string;
}
function groupByCredit(cuotas: ApiCuota[]): CuotaGrouped[] {
  const map = new Map<string, CuotaGrouped>();
  for (const c of cuotas) {
    if (!map.has(c.credito_id)) map.set(c.credito_id, { credito_id: c.credito_id, descripcion: c.credito_descripcion, referadoraNombre: c.credito_referadora_nombre, monto: c.credito_monto, totalCuotas: c.total_cuotas, cuotas: [], estado: c.credito_estado });
    map.get(c.credito_id)!.cuotas.push(c);
  }
  return Array.from(map.values()).sort((a, b) => a.estado === 'desembolsado' ? -1 : b.estado === 'desembolsado' ? 1 : 0);
}

// =============================================================================
// Logo con anillos de pulse.
// small=true  → logo 32px  (cuando hay card de avales debajo)
// small=false → logo 64px  (pantalla limpia sin info adicional)
// =============================================================================
function LogoEvaluacion({ small = false }: { small?: boolean }) {
  const s = small
    ? { wrap: 'w-16 h-16', r1: 'w-16 h-16', r2: 'w-12 h-12', r3: 'w-8 h-8',  img: 'w-8 h-8'  }
    : { wrap: 'w-32 h-32', r1: 'w-32 h-32', r2: 'w-24 h-24', r3: 'w-16 h-16', img: 'w-16 h-16' };
  return (
    <div className="flex justify-center items-center py-2">
      <div className={`relative flex items-center justify-center ${s.wrap}`}>
        <div className={`absolute ${s.r1} rounded-full`} style={{ background: 'radial-gradient(circle, rgba(91,140,90,0.10) 0%, transparent 70%)', animation: 'ping 2.8s cubic-bezier(0,0,0.2,1) infinite' }} />
        <div className={`absolute ${s.r2} rounded-full`} style={{ background: 'radial-gradient(circle, rgba(91,140,90,0.15) 0%, transparent 70%)', animation: 'pulse 2.2s ease-in-out infinite' }} />
        <div className={`absolute ${s.r3} rounded-full`} style={{ background: 'radial-gradient(circle, rgba(91,140,90,0.22) 0%, transparent 70%)', animation: 'pulse 1.9s ease-in-out infinite 0.4s' }} />
        <img src={logoMangle} alt="MANGLE" className={`relative z-10 ${s.img} object-contain`} style={{ animation: 'pulse 3s ease-in-out infinite' }} />
      </div>
    </div>
  );
}

interface CreditGroupProps { group: CuotaGrouped; payingCuotaId: string | null; onPay: ((cuota: ApiCuota) => void) | null; isHistory: boolean; }
function CreditGroup({ group, payingCuotaId, onPay, isHistory }: CreditGroupProps) {
  const pendingCount = group.cuotas.filter((c) => c.estado !== 'pagada').length;
  const label = isHistory ? 'Pagado' : group.estado === 'desembolsado' ? 'Activo' : group.estado;
  return (
    <div>
      <div className={`text-white p-4 rounded-2xl shadow-sm space-y-3 relative overflow-hidden ${isHistory ? 'bg-gradient-to-br from-slate-500 to-slate-700' : 'bg-gradient-to-br from-primary to-ink'}`}>
        <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-white/5" />
        <div className="flex justify-between items-start">
          <div>
            <span className={`text-[9px] uppercase tracking-wider ${isHistory ? 'text-slate-300' : 'text-emerald-200'}`}>{group.descripcion ?? 'Ciclo de Crédito'}</span>
            <h4 className="text-2xl font-black mt-0.5">{formatCopm(group.monto)}</h4>
            <span className={`text-[9px] ${isHistory ? 'text-slate-300' : 'text-emerald-300'}`}>{`+ ${formatCopm(group.cuotas.reduce((s, c) => s + Number(c.monto_interes), 0).toString())} intereses`}</span>
          </div>
          <div className="flex flex-col items-end justify-between self-stretch text-right">
            <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded font-mono">{label}</span>
            {group.referadoraNombre && (
              <span className={`text-[9px] inline-flex items-center gap-1 ${isHistory ? 'text-slate-300' : 'text-emerald-200'}`}>
                <i className="fa-solid fa-handshake-angle text-[10px]" /><span className="font-bold">{group.referadoraNombre}</span>
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-3.5 py-2 border-b border-slate-100 flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {isHistory ? `${group.cuotas.length} cuotas — completado` : `Cuotas (${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''})`}
          </span>
          {isHistory && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1"><i className="fa-solid fa-circle-check" /> Saldado</span>}
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
                      <span className="text-xs font-bold text-slate-700">Cuota {cuota.numero_cuota} de {cuota.total_cuotas}</span>
                      {isPaid ? <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1"><i className="fa-solid fa-circle-check" /> Pagada</span>
                        : isPastDue ? <span className="text-[9px] font-bold text-danger-600 bg-danger-50 px-2 py-0.5 rounded-full">Vencida</span>
                        : <span className="text-[9px] text-slate-400">{daysLeft > 0 ? `En ${daysLeft} días` : 'Vence hoy'}</span>}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatCopm(cuota.monto_cuota)} · Vence {formatDate(cuota.fecha_vencimiento)}</p>
                  </div>
                  {isPending && !isHistory && onPay && (
                    <button onClick={() => onPay(cuota)} disabled={isPaying}
                      className={`ml-2 px-3 py-2 rounded-xl text-[10px] font-extrabold transition flex items-center gap-1 ${isPaying ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : isPastDue ? 'bg-danger-500 hover:bg-danger-600 text-white shadow-sm' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                      {isPaying ? <><i className="fa-solid fa-spinner fa-spin" /> Pagando</> : <><i className="fa-solid fa-money-bill-transfer" /> Pagar</>}
                    </button>
                  )}
                </div>
                {isPaid && cuota.tx_hash_pago && <p className="text-[8px] text-slate-400 mt-1 font-mono truncate">Tx: {cuota.tx_hash_pago}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Repayment() {
  const { state, refreshTokens, showErrorModal } = useAppState();
  const miAlerta = useMiAlerta();
  const nodeAlerta = miAlerta.alerta;
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const wallet = useMiniPay();
  const [payingCuotaId, setPayingCuotaId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const lottieRef = useRef<null>(null);

  const { data: cuotasData, isLoading: cuotasLoading, isError } = useCuotas();
  const { data: pagoConfig, isLoading: configLoading } = usePagoConfig();
  const { estado: creditEstado, isLoading: creditLoading } = useCreditoActivo();
  const { data: pendientesData } = usePendientesAval();
  const cuotas = cuotasData?.cuotas ?? [];
  const error = isError ? 'No se pudo cargar tu información de pagos.' : null;
  const authToken = state.authToken;

  const ownCredit = pendientesData?.creditos?.find((c) => c.es_propio) ?? null;
  const avalesActuales = ownCredit?.avales_actuales ?? 0;
  const avalesMinimos = ownCredit?.avales_minimos ?? 2;
  const avalesFaltantes = Math.max(0, avalesMinimos - avalesActuales);

  const handlePay = useCallback(async (cuota: ApiCuota) => {
    if (payingCuotaId) return;
    if (!pagoConfig) { showToast('Error', 'No se pudo obtener la configuración de pago', 'error'); return; }
    if (!state.walletAddress) { showToast('Error', 'Conectá tu wallet primero', 'error'); return; }
    setPayingCuotaId(cuota.id);
    const refrescar = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.creditos });
      queryClient.invalidateQueries({ queryKey: queryKeys.cuotas });
      queryClient.invalidateQueries({ queryKey: queryKeys.score });
    };
    try {
      let txHash = getPendingTx(cuota.id);
      if (!txHash) {
        showToast('Enviando', cuota.credito_repayment_mode === 'pool' ? 'Confirmá DOS transacciones en tu wallet (autorización + pago).' : 'Confirmá la transacción en tu wallet.', 'info');
        if (cuota.credito_repayment_mode === 'pool') {
          const creditId = keccak256(stringToHex(cuota.credito_id));
          txHash = await wallet.repayCopm(pagoConfig.lendingPoolAddress, creditId, cuota.monto_cuota, state.walletAddress as Address);
        } else {
          txHash = await wallet.sendCopm(pagoConfig.platformWallet as Address, cuota.monto_cuota, state.walletAddress as Address);
        }
        setPendingTx(cuota.id, txHash);
      } else {
        showToast('Reanudando', 'Retomamos un pago anterior que quedó sin confirmar. No se te cobra de nuevo.', 'info');
      }
      showToast('Verificando', 'Transacción enviada. Esperando confirmación on-chain.', 'info');
      const publicClient = createPublicClient({ chain: getActiveChain(), transport: getActiveTransport() });
      let receiptStatus: 'success' | 'reverted' | 'unknown' = 'unknown';
      try {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 90_000 });
        receiptStatus = receipt.status === 'success' ? 'success' : 'reverted';
      } catch { receiptStatus = 'unknown'; }
      if (receiptStatus === 'reverted') { clearPendingTx(cuota.id); throw new Error('La transacción fue revertida en la blockchain. Revisá tu saldo e intentá de nuevo.'); }
      try {
        await apiPost<{ status: string; cuota_id: string; credito_id: string }>('/api/pago', { cuota_id: cuota.id, tx_hash: txHash }, { token: authToken, refreshToken: state.refreshToken, onTokenRefresh: refreshTokens });
      } catch (apiErr) {
        if (apiErr instanceof ApiRequestError) {
          if (['YA_PAGADA', 'YA_PAGADO', 'TX_HASH_DUPLICADO'].includes(apiErr.code)) { clearPendingTx(cuota.id); refrescar(); showToast('Pago confirmado', `La cuota #${cuota.numero_cuota} ya estaba registrada.`, 'success'); return; }
          if (apiErr.code === 'TX_NO_ENCONTRADA') { showToast('Confirmando…', 'El pago se está confirmando en la red. Volvé a tocar "Pagar" en unos segundos — NO se te cobra de nuevo.', 'info'); return; }
          if (apiErr.code === 'TX_REVERTIDA') clearPendingTx(cuota.id);
        }
        throw apiErr;
      }
      clearPendingTx(cuota.id); refrescar();
      showToast('¡Pago Exitoso!', `Cuota #${cuota.numero_cuota} pagada en la blockchain. Tx: ${txHash.slice(0, 10)}…`, 'success');
    } catch (err: any) {
      showErrorModal('Error en el pago', err instanceof ApiRequestError ? (PAGO_ERROR_MESSAGES[err.code] ?? err.message) : (err?.shortMessage || err?.message || 'Error al procesar el pago'));
    } finally { setPayingCuotaId(null); }
  }, [payingCuotaId, pagoConfig, state.walletAddress, state.authToken, state.refreshToken, refreshTokens, wallet, authToken, queryClient]);

  const hasCredits = cuotas.length > 0;
  const grouped = groupByCredit(cuotas);
  const activeGroup = grouped.find((g) => g.estado === 'desembolsado') ?? null;
  const historicalGroups = grouped.filter((g) => g.estado !== 'desembolsado');
  const walletConnected = !!state.walletAddress;
  const isLoading = cuotasLoading || configLoading || creditLoading;

  if (!authToken) return (
    <div className="flex-1 flex flex-col p-5">
      <PageHeader title="Repago de Crédito" subtitle="Ver y pagar tus cuotas." />
      <div className="flex-1 flex items-center justify-center"><div className="text-center max-w-xs"><i className="fa-solid fa-user-lock text-slate-300 text-3xl mb-3" /><p className="text-xs text-slate-500">Iniciá sesión con tu wallet para ver tus cuotas y pagar.</p></div></div>
    </div>
  );

  if (error && !hasCredits) return (
    <div className="flex-1 flex flex-col p-5">
      <PageHeader title="Repago de Crédito" subtitle="Ver y pagar tus cuotas." />
      <div className="flex-1 flex items-center justify-center"><div className="text-center max-w-xs"><i className="fa-solid fa-circle-exclamation text-danger-400 text-3xl mb-3" /><p className="text-xs text-danger-600">{error}</p></div></div>
    </div>
  );

  // ------------------------------------------------------------------
  // Crédito en evaluación — 3 sub-estados con texto congruente
  // ------------------------------------------------------------------
  if (!isLoading && !hasCredits && creditEstado === 'pendiente') {
    // Título y descripción según el estado real de los avales
    const titulo = ownCredit
      ? avalesFaltantes === 0
        ? '¡Casi lista!'
        : 'Esperando avales'
      : 'Solicitud recibida';

    const descripcion = ownCredit
      ? avalesFaltantes === 0
        ? 'Tu grupo ya completó los avales. El equipo MANGLE procesará tu crédito muy pronto.'
        : 'Tu referadora y el Líder Social deben avalar tu solicitud. Podés ver el estado en tu grupo GACC.'
      : 'Tu solicitud fue enviada con éxito y está siendo revisada por el equipo MANGLE.';

    return (
      <div className="flex-1 flex flex-col bg-gradient-to-b from-surface-light to-surface">
        <div className="px-5 pt-5"><PageHeader title="Repago de Crédito" subtitle="Estado de tu solicitud." /></div>
        <div className="flex-1 flex items-center justify-center p-6 -mt-6">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-ink/5 p-8 space-y-5">

            {/* Logo — 64px sin avales, 32px con avales */}
            <LogoEvaluacion small={!!ownCredit} />

            {/* Título y descripción congruentes con el estado */}
            <div className="text-center">
              <h2 className="text-xl font-extrabold text-ink leading-tight">{titulo}</h2>
              <p className="text-sm text-slate-500 font-medium mt-1 leading-relaxed">{descripcion}</p>
            </div>

            {/* Progreso de avales — solo si hay datos */}
            {ownCredit && (
              <div className="bg-surface border border-primary/20 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-[11px] font-bold text-slate-600">Avales del grupo</p>
                  <span className="text-[10px] font-bold text-primary bg-white px-2 py-0.5 rounded-full border border-primary/30">{avalesActuales}/{avalesMinimos} avales</span>
                </div>
                <div className="w-full bg-white/60 rounded-full h-2 overflow-hidden">
                  <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (avalesActuales / avalesMinimos) * 100)}%` }} />
                </div>
                <div className="flex items-center gap-3 text-[10px] pt-1 border-t border-primary/10">
                  <span className={ownCredit.aval_referadora_hecho ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                    {ownCredit.aval_referadora_hecho ? '✓' : '○'} Referadora
                    {ownCredit.referadora_nombre && <span className="font-normal text-slate-500"> ({ownCredit.referadora_nombre})</span>}
                  </span>
                  <span className={ownCredit.aval_lider_hecho ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                    {ownCredit.aval_lider_hecho ? '✓' : '○'} Líder Social
                  </span>
                </div>
              </div>
            )}

            <button onClick={() => navigate('/gacc')} className="w-full py-2.5 rounded-xl text-[11px] font-bold text-primary border border-primary/30 bg-surface hover:bg-primary/5 transition flex items-center justify-center gap-2">
              <i className="fa-solid fa-people-group text-xs" /> Ver mi grupo GACC
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoading && !hasCredits) return (
    <div className="flex-1 flex flex-col p-5">
      <PageHeader title="Repago de Crédito" subtitle="Ver y pagar tus cuotas."
        right={<div className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${nodeAlerta ? 'bg-danger-500 animate-pulse' : 'bg-emerald-500'}`} /><span className={`text-[9px] font-bold ${nodeAlerta ? 'text-danger-700 animate-pulse' : 'text-emerald-700'}`}>{nodeAlerta ? 'Alerta Activa (48h)' : 'Nodo Al Día'}</span></div>}
      />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-xs flex flex-col items-center gap-3">
          <div className="w-40 h-40">{/* @ts-ignore */}<Lottie lottieRef={lottieRef} animationData={walletAnimation} loop autoplay style={{ width: '100%', height: '100%' }} /></div>
          <p className="text-xs text-slate-500 font-medium">No tenés cuotas pendientes.</p>
          <p className="text-[10px] text-slate-400 mt-1">Todas tus cuotas están al día.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col justify-between p-5">
      <div className="space-y-4">
        <PageHeader title="Repago de Crédito" subtitle="Ver y pagar tus cuotas."
          right={<div className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${nodeAlerta ? 'bg-danger-500 animate-pulse' : 'bg-emerald-500'}`} /><span className={`text-[9px] font-bold ${nodeAlerta ? 'text-danger-700 animate-pulse' : 'text-emerald-700'}`}>{nodeAlerta ? 'Alerta Activa (48h)' : 'Nodo Al Día'}</span></div>}
        />
        {isLoading && <div className="flex flex-col items-center justify-center py-10 space-y-3"><i className="fa-solid fa-spinner fa-spin text-3xl text-primary" /><p className="text-xs text-slate-500">Cargando cuotas...</p></div>}
        {!isLoading && (
          <>
            {miAlerta.alerta && (
              <div className="bg-danger-50 border border-danger-200 p-2.5 rounded-xl text-[10px] text-danger-800 animate-pulse">
                <div className="flex gap-1.5 items-start"><i className="fa-solid fa-circle-exclamation text-xs mt-0.5" /><div><strong className="font-bold block">Garantía Social Comprometida</strong>{mensajeAlerta(miAlerta)}</div></div>
              </div>
            )}
            {activeGroup && <CreditGroup group={activeGroup} payingCuotaId={payingCuotaId} onPay={handlePay} isHistory={false} />}
            {historicalGroups.length > 0 && (
              <div>
                <button onClick={() => setHistoryOpen((v) => !v)} className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-bold text-slate-500 uppercase tracking-wider transition hover:bg-slate-100">
                  <span className="flex items-center gap-2"><i className="fa-solid fa-clock-rotate-left" />Historial de créditos ({historicalGroups.length})</span>
                  <i className={`fa-solid fa-chevron-${historyOpen ? 'up' : 'down'} text-slate-400`} />
                </button>
                {historyOpen && <div className="mt-3 space-y-4">{historicalGroups.map((g) => <CreditGroup key={g.credito_id} group={g} payingCuotaId={null} onPay={null} isHistory />)}</div>}
              </div>
            )}
          </>
        )}
      </div>
      {!isLoading && !walletConnected && hasCredits && (
        <div className="pt-4"><div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center"><i className="fa-solid fa-plug text-amber-600 text-base block mb-1" /><p className="text-[11px] font-bold text-amber-800">Conectá tu Wallet</p><p className="text-[10px] text-amber-600 mt-1">Necesitás conectar tu wallet para pagar cuotas en la blockchain.</p></div></div>
      )}
    </div>
  );
}
