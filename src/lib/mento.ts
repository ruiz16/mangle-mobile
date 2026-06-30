// =============================================================================
// Mento — conversión USDm -> COPm para el repago de cuotas
// -----------------------------------------------------------------------------
// Espeja exactamente el flujo probado en mangle-app/scripts/mento/swap-usdm-to-copm.mjs:
//   Mento.create(chainId, rpc) -> routes.findRoute -> quotes.getAmountOut
//   -> swap.buildSwapTransaction (devuelve { approval, swap } con {to,data,value}).
//
// El cliente NO custodia fondos ni usa contrato propio: manda las txs del SDK
// por el provider de MiniPay (ver useMiniPay.swapUsdmToCopm).
//
// Nota de lenguaje: este archivo es lógica interna; la UI nunca muestra
// "USDm"/"COPm"/"swap" — el usuario solo ve pesos.
// =============================================================================

import { parseUnits } from 'viem';
import type { Address } from 'viem';
import { Mento, deadlineFromMinutes } from '@mento-protocol/mento-sdk';
import { getActiveChain, getActiveRpc, getActiveNetwork } from './network';

// Buffer sobre el monto de entrada para que, tras slippage, el COPm recibido
// alcance el objetivo. El pool cobra ~0.3%; usamos slippage 1% + 1.5% de buffer.
const SLIPPAGE_TOLERANCE = 1.0; // %
const INPUT_BUFFER_BPS = 10_150n; // 1.5% extra sobre el cálculo nominal
const BPS = 10_000n;

export interface SwapTxs {
  /** approve USDm -> router de Mento (null si la allowance ya alcanza). */
  approval: { to: Address; data: `0x${string}`; value: bigint } | null;
  /** swap USDm -> COPm. */
  swap: { to: Address; data: `0x${string}`; value: bigint };
  /** USDm (wei) que se gastará. */
  usdmIn: bigint;
}

let mentoPromise: Promise<Mento> | null = null;

function getMento(): Promise<Mento> {
  if (!mentoPromise) {
    const chain = getActiveChain();
    mentoPromise = Mento.create(chain.id, getActiveRpc());
  }
  return mentoPromise;
}

function tokens(): { usdm: Address; copm: Address } {
  const net = getActiveNetwork();
  // En la config, cusdAddress es el USDm (cUSD) de Mento.
  return { usdm: net.cusdAddress, copm: net.copmAddress };
}

/**
 * COPm que rinde 1 USDm ahora (tasa). Útil para mostrar el saldo USDm en pesos
 * y para validar si al usuario le alcanza. Lanza si el oráculo está caído.
 */
export async function copmPerUsdm(): Promise<bigint> {
  const mento = await getMento();
  const { usdm, copm } = tokens();
  const route = await mento.routes.findRoute(usdm, copm);
  return mento.quotes.getAmountOut(usdm, copm, parseUnits('1', 18), route) as Promise<bigint>;
}

/**
 * USDm (wei) necesario para obtener al menos `copmOut` COPm, con buffer.
 */
export async function usdmNeededForCopm(copmOut: bigint): Promise<bigint> {
  const rate = await copmPerUsdm(); // COPm por 1e18 de USDm
  if (rate === 0n) throw new Error('Sin cotización disponible.');
  const nominal = (copmOut * parseUnits('1', 18)) / rate; // USDm wei nominal
  return (nominal * INPUT_BUFFER_BPS) / BPS;
}

/**
 * Construye las txs (approval + swap) para obtener ~`copmOut` COPm desde USDm.
 * `account` es la dirección de la usuaria (origen y destino del swap).
 */
export async function buildSwapForCopm(copmOut: bigint, account: Address): Promise<SwapTxs> {
  const mento = await getMento();
  const { usdm, copm } = tokens();
  const usdmIn = await usdmNeededForCopm(copmOut);

  const route = await mento.routes.findRoute(usdm, copm);
  const { approval, swap } = await mento.swap.buildSwapTransaction(
    usdm,
    copm,
    usdmIn,
    account,
    account,
    { slippageTolerance: SLIPPAGE_TOLERANCE, deadline: deadlineFromMinutes(10) },
    route,
  );

  const norm = (t: { to: string; data: string; value?: bigint } | undefined) =>
    t ? { to: t.to as Address, data: t.data as `0x${string}`, value: t.value ?? 0n } : null;

  const swapNorm = norm(swap?.params ?? swap);
  if (!swapNorm) throw new Error('No se pudo construir la conversión.');

  return { approval: norm(approval), swap: swapNorm, usdmIn };
}
