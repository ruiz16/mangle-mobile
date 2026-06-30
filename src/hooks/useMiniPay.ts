// =============================================================================
// useMiniPay — Real wallet connection hook (MiniPay | MetaMask | any EIP-1193)
// =============================================================================
//
// Contract addresses (COPm) se resuelven DINÁMICAMENTE según el chainId real
// de la wallet usando resolveContractAddresses(chainId).
//
// Si la wallet no está conectada o está en una red no reconocida, se usa
// el fallback estático de VITE_CELO_NETWORK.
//
// FEE ABSTRACTION: en MAINNET las transacciones usan feeCurrency = copmAddress
// para que las usuarias paguen el gas en COPm sin necesitar CELO nativo.
// En TESTNET el Mock NO es fee currency, así que se omite feeCurrency (gas en
// CELO) — incluirlo haría que MiniPay rechace la tx. Ver buildFeeField().
// =============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { createWalletClient, createPublicClient, custom, formatUnits, parseUnits, encodeFunctionData } from 'viem';
import { getActiveChain, getActiveTransport, resolveContractAddresses } from '../lib/network';
import { buildSwapForCopm, usdmNeededForCopm } from '../lib/mento';
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

const ACTIVE_CHAIN = getActiveChain();

// Celo Mainnet chainId. Solo ahí el COPm oficial es fee currency válido.
const CELO_MAINNET_ID = 42220;

/**
 * Devuelve `{ feeCurrency }` SOLO en mainnet, donde el COPm oficial está
 * whitelisteado como fee currency (gas pagado en COPm vía fee abstraction).
 * En testnet el Mock NO es fee currency: incluir feeCurrency haría que el nodo
 * rechace la tx en MiniPay. Por eso ahí devolvemos `{}` (gas en CELO).
 */
function buildFeeField(chainId: number, copmAddress: Address, cusdAddress: Address): { feeCurrency?: Address } {
  if (chainId === CELO_MAINNET_ID) {
    return { feeCurrency: copmAddress };
  }
  // En testnet, el Mock COPm no está whitelisteado como fee currency.
  // Para que funcione el fee abstraction en MiniPay sin requerir CELO,
  // usamos cUSD (USDm) de testnet, que sí está whitelisteado.
  return { feeCurrency: cusdAddress };
}

export interface UseMiniPayReturn {
  isMiniPay: boolean;
  isAvailable: boolean;
  address: Address | null;
  copmBalance: bigint | null;
  copmFormatted: string | null;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<{ address: Address; copmBalance: bigint }>;
  signMessage: (message: string, signerAddress: Address) => Promise<`0x${string}`>;
  getCopmBalance: (addr: Address) => Promise<bigint>;
  getUsdmBalance: (addr: Address) => Promise<bigint>;
  /** Estima el USDm (wei) necesario para obtener `copmOut` COPm. Lanza si no hay cotización. */
  estimateUsdmForCopm: (copmOut: bigint) => Promise<bigint>;
  /** Convierte USDm -> COPm para obtener ~`copmOut`. Manda approval+swap por MiniPay. */
  swapUsdmToCopm: (copmOut: bigint, from: Address) => Promise<void>;
  sendCopm: (to: Address, amountCopm: string, from: Address) => Promise<`0x${string}`>;
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

  const onDisconnectRef = useRef(options?.onDisconnect);
  useEffect(() => {
    onDisconnectRef.current = options?.onDisconnect;
  });

  const provider = typeof window !== 'undefined' ? (window as any).ethereum : undefined;
  const isMiniPay = !!provider?.isMiniPay;
  const isAvailable = !!provider;

  const copmFormatted = copmBalance !== null ? formatUnits(copmBalance, 18) : null;

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

  const getWalletClient = useCallback(() => {
    if (!provider) {
      throw new Error('No se encontró una billetera. Abrí esta app en MiniPay.');
    }
    return createWalletClient({
      chain: ACTIVE_CHAIN,
      transport: custom(provider),
    });
  }, [provider]);

  const connect = useCallback(async (): Promise<{ address: Address; copmBalance: bigint }> => {
    setError(null);
    setIsConnecting(true);

    try {
      if (!provider) {
        throw new Error('No se encontró una billetera. Abrí esta app en MiniPay.');
      }

      const walletClient = getWalletClient();
      const [connectedAddress] = await walletClient.requestAddresses();
      if (!connectedAddress) {
        throw new Error('No se obtuvo acceso a la billetera. Rechazaste la conexión o la billetera no respondió.');
      }

      try {
        await walletClient.switchChain({ id: ACTIVE_CHAIN.id });
      } catch (switchErr: any) {
        if (switchErr?.code === 4902) {
          await walletClient.addChain({ chain: ACTIVE_CHAIN });
        }
      }

      const chainId = await walletClient.getChainId().catch(() => ACTIVE_CHAIN.id);
      const { copmAddress } = resolveContractAddresses(chainId);

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

  const signMessage = useCallback(async (message: string, signerAddress: Address): Promise<`0x${string}`> => {
    if (!signerAddress) {
      throw new Error('Primero conectá tu billetera.');
    }
    const walletClient = getWalletClient();
    const signature = await walletClient.signMessage({
      account: signerAddress,
      message,
    });
    return signature;
  }, [getWalletClient]);

  // --------------------------------------------------------------------------
  // Lee el saldo COPm actual on-chain (fresco) de una dirección.
  // Útil para chequear fondos ANTES de intentar un pago (evita tx fallida).
  // --------------------------------------------------------------------------
  const getCopmBalance = useCallback(async (addr: Address): Promise<bigint> => {
    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: getActiveTransport() });
    const { copmAddress } = resolveContractAddresses(ACTIVE_CHAIN.id);
    return publicClient.readContract({
      address: copmAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [addr],
    }) as Promise<bigint>;
  }, []);

  // --------------------------------------------------------------------------
  // Saldo de USDm (dólares digitales) — fondo desde el que se convierte a COPm.
  // --------------------------------------------------------------------------
  const getUsdmBalance = useCallback(async (addr: Address): Promise<bigint> => {
    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: getActiveTransport() });
    const { cusdAddress } = resolveContractAddresses(ACTIVE_CHAIN.id);
    return publicClient.readContract({
      address: cusdAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [addr],
    }) as Promise<bigint>;
  }, []);

  const estimateUsdmForCopm = useCallback(async (copmOut: bigint): Promise<bigint> => {
    return usdmNeededForCopm(copmOut);
  }, []);

  // --------------------------------------------------------------------------
  // Convierte USDm -> COPm vía Mento (SDK) para obtener ~copmOut. Manda las txs
  // (approval + swap) por el provider de MiniPay. El gas se paga en USDm para
  // no requerir COPm/CELO previos. Espera el recibo del swap antes de retornar.
  // --------------------------------------------------------------------------
  const swapUsdmToCopm = useCallback(async (copmOut: bigint, from: Address): Promise<void> => {
    if (!provider) throw new Error('No se encontró una billetera.');

    const { approval, swap } = await buildSwapForCopm(copmOut, from);

    const { cusdAddress } = resolveContractAddresses(ACTIVE_CHAIN.id);
    const feeField = { feeCurrency: cusdAddress }; // gas en USDm
    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: getActiveTransport() });

    const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
    const currentFrom = (accounts[0] ?? from) as Address;

    if (approval) {
      const approveHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: currentFrom, to: approval.to, data: approval.data, ...feeField }],
      }) as `0x${string}`;
      const r = await publicClient.waitForTransactionReceipt({ hash: approveHash, timeout: 60_000 });
      if (r.status !== 'success') throw new Error('No pudimos preparar tu pago. Intentá de nuevo.');
    }

    const swapHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: currentFrom, to: swap.to, data: swap.data, ...feeField }],
    }) as `0x${string}`;
    const rec = await publicClient.waitForTransactionReceipt({ hash: swapHash, timeout: 90_000 });
    if (rec.status !== 'success') throw new Error('No pudimos preparar tu pago. Intentá de nuevo.');
  }, [provider]);

  // --------------------------------------------------------------------------
  // Send COPm via ERC-20 transfer
  // feeCurrency = copmAddress → gas pagado en COPm, sin CELO nativo
  // --------------------------------------------------------------------------
  const sendCopm = useCallback(async (
    to: Address,
    amountCopm: string,
    from: Address,
  ): Promise<`0x${string}`> => {
    if (!provider) {
      throw new Error('No se encontró una billetera.');
    }

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
    const { copmAddress, cusdAddress } = resolveContractAddresses(chainId);
    const amountWei = parseUnits(String(amountCopm), 18);

    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to, amountWei],
    });

    const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
    const currentFrom = (accounts[0] ?? from) as Address;

    // ✅ feeCurrency: COPm en mainnet, cUSD en testnet (para MiniPay fee abstraction)
    const feeField = buildFeeField(chainId, copmAddress, cusdAddress);
    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: currentFrom, to: copmAddress, data, ...feeField }],
    }) as `0x${string}`;

    return txHash;
  }, [provider]);

  // --------------------------------------------------------------------------
  // Repay COPm via LendingPool: approve + repay
  // feeCurrency = copmAddress en ambas txs → sin CELO nativo requerido
  // --------------------------------------------------------------------------
  const repayCopm = useCallback(async (
    poolAddress: Address,
    creditId: `0x${string}`,
    amountCopm: string,
    from: Address,
  ): Promise<`0x${string}`> => {
    if (!provider) throw new Error('No se encontró una billetera.');

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
    const { copmAddress, cusdAddress } = resolveContractAddresses(chainId);
    const amountWei = parseUnits(String(amountCopm), 18);

    const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
    const currentFrom = (accounts[0] ?? from) as Address;

    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: getActiveTransport() });

    // 1. Approve si el allowance no alcanza
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

      // ✅ feeCurrency: COPm en mainnet, cUSD en testnet
      const approveTx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: currentFrom, to: copmAddress, data: approveData, ...buildFeeField(chainId, copmAddress, cusdAddress) }],
      }) as `0x${string}`;

      const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx, timeout: 60_000 });
      if (approveReceipt.status !== 'success') {
        throw new Error('No pudimos procesar tu pago. Intentá de nuevo.');
      }

      // Esperar que el allowance se refleje on-chain
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

    // ✅ feeCurrency: COPm en mainnet, cUSD en testnet
    const repayTx = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: currentFrom, to: poolAddress, data: repayData, ...buildFeeField(chainId, copmAddress, cusdAddress) }],
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
    getCopmBalance,
    getUsdmBalance,
    estimateUsdmForCopm,
    swapUsdmToCopm,
    sendCopm,
    repayCopm,
  };
}
