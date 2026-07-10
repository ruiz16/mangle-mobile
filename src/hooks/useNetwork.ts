// =============================================================================
// useNetwork — Red de la wallet en tiempo real (vía wagmi)
// =============================================================================
// Lee el chainId de la wallet conectada desde wagmi (useAccount). wagmi maneja
// la reactividad ante cambios de red/conexión. Si no hay wallet, cae al
// fallback estático de VITE_CELO_NETWORK.
// =============================================================================

import { useAccount } from 'wagmi';
import { celo, celoSepolia } from 'viem/chains';
import { resolveContractAddresses, getActiveNetwork } from '../lib/network';
import type { NetworkConfig } from '../lib/network';

export const CHAIN_IDS = {
  CELO_MAINNET: celo.id,        // 42220
  CELO_SEPOLIA: celoSepolia.id, // 11142220
} as const;

export interface UseNetworkReturn {
  chainId: number | null;
  config: NetworkConfig;
  copmAddress: `0x${string}`;
  cusdAddress: `0x${string}`;
  isConnected: boolean;
  isMainnet: boolean;
  isSepolia: boolean;
}

export function useNetwork(): UseNetworkReturn {
  const { chainId: wagmiChainId } = useAccount();
  const chainId = wagmiChainId ?? null;

  const config = chainId ? resolveContractAddresses(chainId) : getActiveNetwork();

  return {
    chainId,
    config,
    copmAddress: config.copmAddress,
    cusdAddress: config.cusdAddress,
    isConnected: chainId != null,
    isMainnet: chainId === CHAIN_IDS.CELO_MAINNET,
    isSepolia: chainId === CHAIN_IDS.CELO_SEPOLIA,
  };
}
