// =============================================================================
// Mangle — Network & Contract Address Configuration
// =============================================================================
//
// Two modes:
//   STATIC  → getCopmAddress(), getActiveChain() etc.  — usan VITE_CELO_NETWORK
//   DYNAMIC → resolveContractAddresses(chainId)         — usan el chainId real
//
// La Static se usa cuando NO hay wallet conectada (fallback).
// La Dynamic se usa cuando la wallet ya está conectada y sabemos su chainId.
//
// Ambos modos leen las direcciones desde variables de entorno.
// =============================================================================

import { celo, celoSepolia } from 'viem/chains';
import type { Chain } from 'viem';

// =============================================================================
// Types
// =============================================================================

export type CeloNetwork = 'mainnet' | 'sepolia';

export interface NetworkConfig {
  chain: Chain;
  rpc: string;
  copmAddress: `0x${string}`;
  cusdAddress: `0x${string}`;
  apiBase: string;
  lendingPoolAddress: `0x${string}`;
}

// =============================================================================
// Env var helper — todas las variables SON REQUERIDAS, sin defaults
// =============================================================================

function requireEnv(name: string): string {
  if (typeof import.meta === 'undefined' || !import.meta.env?.[name]) {
    throw new Error(
      `Falta ${name} en las variables de entorno. ` +
        'Revisá .env.example para la configuración necesaria.',
    );
  }
  return import.meta.env[name] as string;
}

// =============================================================================
// Network config (lazy getters — solo valida la red que se accede)
// =============================================================================

export const NETWORK_CONFIG: Record<CeloNetwork, NetworkConfig> = {
  get mainnet() {
    return {
      chain: celo,
      rpc: requireEnv('VITE_CELO_MAINNET_RPC'),
      copmAddress: requireEnv('VITE_COPM_MAINNET') as `0x${string}`,
      cusdAddress: requireEnv('VITE_CUSD_MAINNET') as `0x${string}`,
      apiBase: requireEnv('VITE_API_URL'),
      lendingPoolAddress: requireEnv('VITE_LENDING_POOL_MAINNET') as `0x${string}`,
    };
  },
  get sepolia() {
    return {
      chain: celoSepolia,
      rpc: requireEnv('VITE_CELO_SEPOLIA_RPC'),
      copmAddress: requireEnv('VITE_COPM_SEPOLIA') as `0x${string}`,
      cusdAddress: requireEnv('VITE_CUSD_SEPOLIA') as `0x${string}`,
      apiBase: requireEnv('VITE_API_URL'),
      lendingPoolAddress: requireEnv('VITE_LENDING_POOL_SEPOLIA') as `0x${string}`,
    };
  },
};

// =============================================================================
// Static mode — red elegida en compile-time via VITE_CELO_NETWORK
// =============================================================================

/** Active network — set via VITE_CELO_NETWORK env var. REQUERIDO. */
export const ACTIVE_NETWORK: CeloNetwork = requireEnv(
  'VITE_CELO_NETWORK',
) as CeloNetwork;

/** Get the full static network config */
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

export function getCusdAddress(): `0x${string}` {
  return getActiveNetwork().cusdAddress;
}

export function getApiBase(): string {
  return getActiveNetwork().apiBase;
}

// =============================================================================
// Dynamic mode — elige la red según el chainId real de la wallet
// =============================================================================

/**
 * Resuelve la configuración de red basándose en el chainId de la wallet.
 *
 * Uso típico: después de conectar la wallet, pasale el chainId que devuelve
 * `walletClient.getChainId()` o `provider.request({ method: 'eth_chainId' })`.
 *
 * Si no se pasa chainId o la red no es reconocida, cae al static fallback.
 *
 * @example
 *   const { copmAddress, cusdAddress } = resolveContractAddresses(42220n);
 *   // → { copmAddress: '0x8A56...', cusdAddress: '0x765D...' }
 */
export function resolveContractAddresses(
  chainId?: number | bigint | null,
): NetworkConfig {
  if (chainId != null) {
    const id = Number(chainId);
    if (id === celo.id) return NETWORK_CONFIG.mainnet;
    if (id === celoSepolia.id) return NETWORK_CONFIG.sepolia;
  }
  // Fallback: usar la red estática (VITE_CELO_NETWORK)
  return getActiveNetwork();
}
