// =============================================================================
// Wallet — saldo COPm on-chain como server-state (TanStack Query)
// =============================================================================
//
// Lecturas reactivas del saldo. NO usa useMiniPay (ese es para conexión y
// escrituras). Reusa el transporte resiliente fallback() de lib/network.ts.
// =============================================================================

import { useQuery } from '@tanstack/react-query';
import { createPublicClient } from 'viem';
import type { Address } from 'viem';
import { getActiveChain, getActiveTransport, resolveContractAddresses } from '../lib/network';
import { useAppState } from '../context/AppState';
import { queryKeys } from './client';

const BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// Module-level singleton — built once.
const publicClient = createPublicClient({
  chain: getActiveChain(),
  transport: getActiveTransport(),
});

/** Lee el saldo COPm fresco on-chain de una dirección. */
export async function readCopmBalanceOf(address: Address): Promise<bigint> {
  const { copmAddress } = resolveContractAddresses(getActiveChain().id);
  return publicClient.readContract({
    address: copmAddress,
    abi: BALANCE_ABI,
    functionName: 'balanceOf',
    args: [address],
  }) as Promise<bigint>;
}

/**
 * Saldo COPm de la usuaria conectada, como server-state.
 * Refresco: event-driven (focus + invalidación tras pago) + 30s de red de
 * seguridad para ingresos externos.
 */
export function useCopmBalance() {
  const { state } = useAppState();
  const address = state.walletAddress as Address | null;
  return useQuery({
    queryKey: queryKeys.copmBalance(address),
    enabled: !!address,
    queryFn: () => readCopmBalanceOf(address as Address),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}
