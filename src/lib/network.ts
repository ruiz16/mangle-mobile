// =============================================================================
// Mangle — Network Configuration (Celo)
// =============================================================================

import { celo, celoSepolia } from 'viem/chains';
import type { Chain } from 'viem';

export type CeloNetwork = 'mainnet' | 'sepolia';

interface NetworkConfig {
  chain: Chain;
  rpc: string;
  copmAddress: `0x${string}`;
}

export const NETWORK_CONFIG: Record<CeloNetwork, NetworkConfig> = {
  mainnet: {
    chain: celo,
    rpc: 'https://forno.celo.org',
    copmAddress: '0x8A567e2aE79CA692Bd748aB832081C45de4041eA',
  },
  sepolia: {
    chain: celoSepolia,
    rpc: 'https://forno.celo-sepolia.celo-testnet.org',
    copmAddress: '0x5F8d55c3627d2dc0a2B4afa798f877242F382F67',
  },
};

/** Active network — set via VITE_CELO_NETWORK env var, defaults to sepolia */
export const ACTIVE_NETWORK: CeloNetwork =
  (import.meta.env.VITE_CELO_NETWORK as CeloNetwork) ?? 'sepolia';

export function getActiveNetwork(): NetworkConfig {
  return NETWORK_CONFIG[ACTIVE_NETWORK];
}

export function getActiveChain(): Chain {
  return getActiveNetwork().chain;
}

export function getActiveRpc(): string {
  return getActiveNetwork().rpc;
}

export function getCopmAddress(): `0x${string}` {
  return getActiveNetwork().copmAddress;
}
