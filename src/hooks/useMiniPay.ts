// =============================================================================
// useMiniPay — Real wallet connection hook (MiniPay | MetaMask | any EIP-1193)
// =============================================================================
//
// Contract addresses (COPm) se resuelven DINÁMICAMENTE según el chainId real
// de la wallet usando resolveContractAddresses(chainId).
//
// Si la wallet no está conectada o está en una red no reconocida, se usa
// el fallback estático de VITE_CELO_NETWORK.
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { createWalletClient, createPublicClient, custom, http, formatUnits, parseUnits } from 'viem';
import { getActiveChain, getActiveRpc, resolveContractAddresses } from '../lib/network';
import type { Address } from 'viem';

// Minimal ERC-20 ABI for balanceOf + transfer
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// Static fallback (compile-time) — se usa solo como default cuando la wallet
// no está conectada. Las funciones connect() y sendCopm() resuelven las
// direcciones dinámicamente al ejecutarse.
const ACTIVE_CHAIN = getActiveChain();
const RPC_URL = getActiveRpc();

export interface UseMiniPayReturn {
  /** True if running inside MiniPay WebView */
  isMiniPay: boolean;
  /** True if any EIP-1193 provider is available */
  isAvailable: boolean;
  /** Connected wallet address */
  address: Address | null;
  /** COPm balance as raw bigint (18 decimals) */
  copmBalance: bigint | null;
  /** COPm balance formatted as string (e.g. "12.50") */
  copmFormatted: string | null;
  /** Whether a connection is in progress */
  isConnecting: boolean;
  /** Last error message, if any */
  error: string | null;
  /** Connect to wallet — throws if fails */
  connect: () => Promise<{ address: Address; copmBalance: bigint }>;
  /** Sign a SIWE message with personal_sign — throws if fails */
  signMessage: (message: string, signerAddress: Address) => Promise<`0x${string}`>;
  /**
   * Send COPm via ERC-20 transfer to a destination address.
   * Returns the transaction hash.
   *
   * @param to - Recipient address (platform wallet)
   * @param amountCopm - Amount in COPm (decimal string, e.g. "100000.00")
   * @param from - The sender's wallet address (must be connected)
   */
  sendCopm: (to: Address, amountCopm: string, from: Address) => Promise<`0x${string}`>;
}

export function useMiniPay(): UseMiniPayReturn {
  const [address, setAddress] = useState<Address | null>(null);
  const [copmBalance, setCopmBalance] = useState<bigint | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = typeof window !== 'undefined' ? (window as any).ethereum : undefined;
  const isMiniPay = !!provider?.isMiniPay;
  const isAvailable = !!provider;

  const copmFormatted = copmBalance !== null ? formatUnits(copmBalance, 18) : null;

  // --------------------------------------------------------------------------
  // Listen for account changes (MetaMask account switch, MiniPay re-grant, etc.)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!provider) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs.length === 0) {
        setAddress(null);
        setCopmBalance(null);
      } else {
        setAddress(accs[0] as Address);
      }
    };

    provider.on('accountsChanged', handleAccountsChanged);

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [provider]);

  // --------------------------------------------------------------------------
  // Helper: create a wallet client from the current provider
  // --------------------------------------------------------------------------
  const getWalletClient = useCallback(() => {
    if (!provider) {
      throw new Error('No se encontró una wallet. Instalá MetaMask o abrí esta app en MiniPay.');
    }
    return createWalletClient({
      chain: ACTIVE_CHAIN,
      transport: custom(provider),
    });
  }, [provider]);

  // --------------------------------------------------------------------------
  // Connect
  // --------------------------------------------------------------------------
  const connect = useCallback(async (): Promise<{ address: Address; copmBalance: bigint }> => {
    setError(null);
    setIsConnecting(true);

    try {
      if (!provider) {
        throw new Error('No se encontró una wallet. Instalá MetaMask o abrí esta app en MiniPay.');
      }

      // 1. Create wallet client with the browser provider
      const walletClient = getWalletClient();

      // 2. Request accounts — eth_requestAccounts: opens MetaMask popup
      const [connectedAddress] = await walletClient.requestAddresses();
      if (!connectedAddress) {
        throw new Error('No se obtuvo acceso a la wallet. Rechazaste la conexión o la wallet no respondió.');
      }

      // 3. Try to switch chain to Celo if not already
      try {
        await walletClient.switchChain({ id: ACTIVE_CHAIN.id });
      } catch (switchErr: any) {
        // 4902 = chain not in MetaMask, try to add it
        if (switchErr?.code === 4902) {
          await walletClient.addChain({ chain: ACTIVE_CHAIN });
        } else if (switchErr?.code !== 4001) {
          // 4001 = user rejected chain switch — ignore, might already be on Celo
          // MiniPay may not support switchChain — ignore silently
        }
      }

      // 4. Detectar chainId REAL y resolver direcciones de contrato
      const chainId = await walletClient.getChainId().catch(() => ACTIVE_CHAIN.id);
      const { copmAddress } = resolveContractAddresses(chainId);

      // 5. Read COPm balance desde la dirección correcta según la red
      const publicClient = createPublicClient({
        chain: ACTIVE_CHAIN,
        transport: http(RPC_URL),
      });

      const balance = await publicClient.readContract({
        address: copmAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [connectedAddress],
      });

      setAddress(connectedAddress);
      setCopmBalance(balance);
      setError(null);

      return { address: connectedAddress, copmBalance: balance };
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Error desconocido al conectar la wallet.';
      setError(msg);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [provider]);

  // --------------------------------------------------------------------------
  // Sign a SIWE message with personal_sign
  // --------------------------------------------------------------------------
  const signMessage = useCallback(async (message: string, signerAddress: Address): Promise<`0x${string}`> => {
    if (!signerAddress) {
      throw new Error('Primero conectá tu wallet.');
    }

    const walletClient = getWalletClient();

    const signature = await walletClient.signMessage({
      account: signerAddress,
      message,
    });

    return signature;
  }, [getWalletClient]);

  // --------------------------------------------------------------------------
  // Send COPm via ERC-20 transfer
  // --------------------------------------------------------------------------
  const sendCopm = useCallback(async (
    to: Address,
    amountCopm: string,
    from: Address,
  ): Promise<`0x${string}`> => {
    const walletClient = getWalletClient();

    // Detectar la red actual y resolver la dirección de COPm
    const chainId = await walletClient.getChainId().catch(() => ACTIVE_CHAIN.id);
    const { copmAddress } = resolveContractAddresses(chainId);

    // Convert decimal COPm to wei (18 decimals)
    const amountWei = parseUnits(amountCopm, 18);

    const txHash = await walletClient.writeContract({
      address: copmAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to, amountWei],
      account: from,
    });

    return txHash;
  }, [getWalletClient]);

  return {
    isMiniPay,
    isAvailable,
    address,
    copmBalance,
    copmFormatted,
    isConnecting,
    error,
    connect,
    signMessage,
    sendCopm,
  };
}
