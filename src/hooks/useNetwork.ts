// =============================================================================
// useNetwork — Detecta la red de la wallet en tiempo real
// =============================================================================
//
// Reemplaza funcionalmente a wagmi.useChainId() sin la dependencia.
// Lee window.ethereum.chainId (hex → decimal) y resuelve las direcciones
// de contrato correspondientes mediante resolveContractAddresses().
//
// Si la wallet no está conectada o no se puede leer el chainId, cae al
// fallback estático de VITE_CELO_NETWORK (Sepolia por defecto).
// =============================================================================

import { useState, useEffect } from 'react';
import { celo, celoSepolia } from 'viem/chains';
import { resolveContractAddresses, getActiveNetwork } from '../lib/network';
import type { NetworkConfig } from '../lib/network';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Lee el chainId desde window.ethereum y lo convierte a número decimal.
 * Retorna null si no hay provider o si falla la lectura.
 */
function readChainIdFromProvider(): number | null {
  try {
    const provider =
      typeof window !== 'undefined'
        ? (window as unknown as { ethereum?: { chainId?: string } }).ethereum
        : null;

    if (!provider?.chainId) return null;

    // chainId viene como hex "0x..." de la wallet
    const hex = provider.chainId;
    if (typeof hex !== 'string' || !hex.startsWith('0x')) return null;

    return Number.parseInt(hex, 16);
  } catch {
    return null;
  }
}

/** Celo chain IDs como constantes nombradas */
export const CHAIN_IDS = {
  CELO_MAINNET: celo.id,       // 42220
  CELO_SEPOLIA: celoSepolia.id, // 11142220
} as const;

// =============================================================================
// Hook
// =============================================================================

export interface UseNetworkReturn {
  /** Chain ID actual de la wallet (decimal). Null si no hay wallet conectada. */
  chainId: number | null;
  /** Configuración de red resuelta (addresses, RPC, chain) */
  config: NetworkConfig;
  /** Dirección del token COPm para la red actual */
  copmAddress: `0x${string}`;
  /** Dirección del token cUSD para la red actual */
  cusdAddress: `0x${string}`;
  /** True si la wallet está conectada y en una red conocida */
  isConnected: boolean;
  /** True si la wallet está en Celo Mainnet (42220) */
  isMainnet: boolean;
  /** True si la wallet está en Celo Sepolia (11142220) */
  isSepolia: boolean;
}

export function useNetwork(): UseNetworkReturn {
  const [chainId, setChainId] = useState<number | null>(() => readChainIdFromProvider());

  // ── Escuchar cambios de red en la wallet ──────────────────────────────
  useEffect(() => {
    const provider =
      typeof window !== 'undefined'
        ? (window as unknown as { ethereum?: { on?: Function; removeListener?: Function } }).ethereum
        : null;

    if (!provider?.on) return;

    const handleChainChanged = (hexChainId: string) => {
      const id = Number.parseInt(hexChainId, 16);
      setChainId(Number.isNaN(id) ? null : id);
    };

    provider.on('chainChanged', handleChainChanged);

    return () => {
      if (provider.removeListener) {
        provider.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  // ── Resolver addresses según chainId ──────────────────────────────────
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
