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

import { useState, useCallback, useEffect, useRef } from 'react';
import { createWalletClient, createPublicClient, custom, formatUnits, parseUnits, encodeFunctionData } from 'viem';
import { getActiveChain, getActiveTransport, resolveContractAddresses } from '../lib/network';
import type { Address } from 'viem';

// Minimal ERC-20 ABI for balanceOf + transfer + approve
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
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const LENDING_POOL_ABI = [
  {
    name: 'repay',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'creditId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

// Static fallback (compile-time) — se usa solo como default cuando la wallet
// no está conectada. Las funciones connect() y sendCopm() resuelven las
// direcciones dinámicamente al ejecutarse.
const ACTIVE_CHAIN = getActiveChain();

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
  /**
   * Repaga un crédito vía LendingPool: approve(pool, amount) + repay(creditId, amount).
   * Devuelve el hash de la tx de repay. Requiere 2 confirmaciones en la wallet.
   */
  repayCopm: (
    poolAddress: Address,
    creditId: `0x${string}`,
    amountCopm: string,
    from: Address,
  ) => Promise<`0x${string}`>;
}

export function useMiniPay(options?: { onDisconnect?: () => void }): UseMiniPayReturn {
  const [address, setAddress] = useState<Address | null>(null);
  const [copmBalance, setCopmBalance] = useState<bigint | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable ref so the disconnect callback never needs to be in effect deps
  const onDisconnectRef = useRef(options?.onDisconnect);
  useEffect(() => {
    onDisconnectRef.current = options?.onDisconnect;
  });

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
        onDisconnectRef.current?.();
      } else {
        setAddress(accs[0] as Address);
      }
    };

    const handleDisconnect = () => {
      setAddress(null);
      setCopmBalance(null);
      onDisconnectRef.current?.();
    };

    const handleOffline = () => {
      onDisconnectRef.current?.();
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('disconnect', handleDisconnect);
    window.addEventListener('offline', handleOffline);

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('disconnect', handleDisconnect);
      window.removeEventListener('offline', handleOffline);
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
        transport: getActiveTransport(),
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
    if (!provider) {
      throw new Error('No se encontró una wallet.');
    }

    // 1. Switch to Celo before doing anything
    const switchClient = createWalletClient({ chain: ACTIVE_CHAIN, transport: custom(provider) });
    try {
      await switchClient.switchChain({ id: ACTIVE_CHAIN.id });
    } catch (switchErr: any) {
      if (switchErr?.code === 4902) {
        await switchClient.addChain({ chain: ACTIVE_CHAIN });
        await switchClient.switchChain({ id: ACTIVE_CHAIN.id });
      }
      // 4001 (user rejected) or MiniPay (no switchChain) — continue anyway
    }

    // 2. Resolve contract address from actual chain
    const chainId = await switchClient.getChainId().catch(() => ACTIVE_CHAIN.id);
    const { copmAddress } = resolveContractAddresses(chainId);

    // 3. Convert decimal COPm string to wei (18 decimals)
    const amountWei = parseUnits(String(amountCopm), 18);

    // 4. Encode ERC-20 transfer calldata
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to, amountWei],
    });

    // 5. Fetch the current account from the provider at send time — avoids
    //    "from should be same as current address" if state.walletAddress is stale.
    const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
    const currentFrom = (accounts[0] ?? from) as Address;

    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: currentFrom, to: copmAddress, data }],
    }) as `0x${string}`;

    return txHash;
  }, [provider]);

  // --------------------------------------------------------------------------
  // Repay COPm via LendingPool: approve(pool, amount) + repay(creditId, amount)
  // --------------------------------------------------------------------------
  const repayCopm = useCallback(async (
    poolAddress: Address,
    creditId: `0x${string}`,
    amountCopm: string,
    from: Address,
  ): Promise<`0x${string}`> => {
    if (!provider) throw new Error('No se encontró una wallet.');

    const switchClient = createWalletClient({ chain: ACTIVE_CHAIN, transport: custom(provider) });
    try {
      await switchClient.switchChain({ id: ACTIVE_CHAIN.id });
    } catch (switchErr: any) {
      if (switchErr?.code === 4902) {
        await switchClient.addChain({ chain: ACTIVE_CHAIN });
        await switchClient.switchChain({ id: ACTIVE_CHAIN.id });
      }
    }

    const chainId = await switchClient.getChainId().catch(() => ACTIVE_CHAIN.id);
    const { copmAddress } = resolveContractAddresses(chainId);
    const amountWei = parseUnits(String(amountCopm), 18);

    const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
    const currentFrom = (accounts[0] ?? from) as Address;

    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: getActiveTransport() });

    // 1. Aprobar solo si el allowance actual no alcanza (evita tx innecesaria).
    const currentAllowance = await publicClient.readContract({
      address: copmAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [currentFrom, poolAddress],
    }) as bigint;

    if (currentAllowance < amountWei) {
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [poolAddress, amountWei],
      });
      const approveTx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: currentFrom, to: copmAddress, data: approveData }],
      }) as `0x${string}`;

      // Confirmar que el approve quedó minado Y exitoso (waitForTransactionReceipt
      // NO lanza si revirtió: devuelve status 'reverted').
      const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx, timeout: 60_000 });
      if (approveReceipt.status !== 'success') {
        throw new Error('La aprobación de COPm falló. Reintenta el pago.');
      }

      // Esperar a que el allowance se refleje on-chain ANTES del repay para
      // eliminar el race con la simulación de la wallet.
      for (let i = 0; i < 15; i++) {
        const a = await publicClient.readContract({
          address: copmAddress,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [currentFrom, poolAddress],
        }) as bigint;
        if (a >= amountWei) break;
        if (i === 14) throw new Error('El permiso (allowance) no se reflejó a tiempo. Reintenta el pago.');
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    // 2. repay(creditId, amount)
    const repayData = encodeFunctionData({
      abi: LENDING_POOL_ABI,
      functionName: 'repay',
      args: [creditId, amountWei],
    });
    const repayTx = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: currentFrom, to: poolAddress, data: repayData }],
    }) as `0x${string}`;

    return repayTx;
  }, [provider]);

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
    repayCopm,
  };
}
