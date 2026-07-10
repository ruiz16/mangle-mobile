// =============================================================================
// useMiniPay — Wallet ops sobre el provider ACTIVO de wagmi
// =============================================================================
// La CONEXIÓN la maneja wagmi + RainbowKit (ver lib/wagmi.ts, lib/minipay.ts).
// Este hook toma el provider EIP-1193 del connector conectado y ejecuta firma,
// saldos, swap USDm→COPm y pagos. La interfaz pública NO cambió.
//
// FEE ABSTRACTION: mainnet → feeCurrency=copmAddress; testnet → cUSD (USDm).
// =============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { createWalletClient, createPublicClient, custom, formatUnits, parseUnits, encodeFunctionData } from 'viem';
import { getActiveChain, getActiveTransport, resolveContractAddresses } from '../lib/network';
import { buildSwapForCopm, usdmNeededForCopm } from '../lib/mento';
import { useIsMiniPay } from '../lib/minipay';
import type { Address } from 'viem';

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
const CELO_MAINNET_ID = 42220;

function buildFeeField(chainId: number, copmAddress: Address, cusdAddress: Address): { feeCurrency?: Address } {
  if (chainId === CELO_MAINNET_ID) {
    return { feeCurrency: copmAddress };
  }
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
  estimateUsdmForCopm: (copmOut: bigint) => Promise<bigint>;
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
  const { address: wagmiAddress, isConnected, connector } = useAccount();
  const inMiniPay = useIsMiniPay();

  const [copmBalance, setCopmBalance] = useState<bigint | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDisconnectRef = useRef(options?.onDisconnect);
  useEffect(() => {
    onDisconnectRef.current = options?.onDisconnect;
  });

  const address = (wagmiAddress ?? null) as Address | null;
  const isAvailable = isConnected;
  const copmFormatted = copmBalance !== null ? formatUnits(copmBalance, 18) : null;

  const getProvider = useCallback(async (): Promise<any> => {
    if (!connector) {
      throw new Error('No se encontró una billetera. Conectá tu billetera para continuar.');
    }
    const provider = await connector.getProvider();
    if (!provider) {
      throw new Error('No se encontró una billetera. Conectá tu billetera para continuar.');
    }
    return provider;
  }, [connector]);

  const getWalletClient = useCallback(async () => {
    const provider = await getProvider();
    return createWalletClient({ chain: ACTIVE_CHAIN, transport: custom(provider) });
  }, [getProvider]);

  // Desconexión (wagmi) + pérdida de red.
  const wasConnectedRef = useRef(false);
  useEffect(() => {
    if (isConnected) {
      wasConnectedRef.current = true;
    } else if (wasConnectedRef.current) {
      wasConnectedRef.current = false;
      setCopmBalance(null);
      onDisconnectRef.current?.();
    }
  }, [isConnected]);

  useEffect(() => {
    const handleOffline = () => onDisconnectRef.current?.();
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, []);

  // `connect()` queda por compatibilidad de interfaz: refresca el saldo de la
  // address ya conectada (la conexión real la hace wagmi/RainbowKit).
  const connect = useCallback(async (): Promise<{ address: Address; copmBalance: bigint }> => {
    setError(null);
    setIsConnecting(true);
    try {
      if (!wagmiAddress) {
        throw new Error('Conectá tu billetera primero.');
      }
      const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: getActiveTransport() });
      const { copmAddress } = resolveContractAddresses(ACTIVE_CHAIN.id);
      const balance = (await publicClient.readContract({
        address: copmAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [wagmiAddress],
      })) as bigint;
      setCopmBalance(balance);
      return { address: wagmiAddress as Address, copmBalance: balance };
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Error al leer el saldo.';
      setError(msg);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [wagmiAddress]);

  const signMessage = useCallback(async (message: string, signerAddress: Address): Promise<`0x${string}`> => {
    if (!signerAddress) {
      throw new Error('Primero conectá tu billetera.');
    }
    const walletClient = await getWalletClient();
    return walletClient.signMessage({ account: signerAddress, message });
  }, [getWalletClient]);

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

  const swapUsdmToCopm = useCallback(async (copmOut: bigint, from: Address): Promise<void> => {
    const provider = await getProvider();
    const { approval, swap } = await buildSwapForCopm(copmOut, from);
    const { cusdAddress } = resolveContractAddresses(ACTIVE_CHAIN.id);
    const feeField = { feeCurrency: cusdAddress };
    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: getActiveTransport() });

    const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
    const currentFrom = (accounts[0] ?? from) as Address;

    if (approval) {
      const approveHash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: currentFrom, to: approval.to, data: approval.data, ...feeField }],
      })) as `0x${string}`;
      const r = await publicClient.waitForTransactionReceipt({ hash: approveHash, timeout: 60_000 });
      if (r.status !== 'success') throw new Error('No pudimos preparar tu pago. Intentá de nuevo.');
    }

    const swapHash = (await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: currentFrom, to: swap.to, data: swap.data, ...feeField }],
    })) as `0x${string}`;
    const rec = await publicClient.waitForTransactionReceipt({ hash: swapHash, timeout: 90_000 });
    if (rec.status !== 'success') throw new Error('No pudimos preparar tu pago. Intentá de nuevo.');
  }, [getProvider]);

  const sendCopm = useCallback(async (
    to: Address,
    amountCopm: string,
    from: Address,
  ): Promise<`0x${string}`> => {
    const provider = await getProvider();
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

    const data = encodeFunctionData({ abi: ERC20_ABI, functionName: 'transfer', args: [to, amountWei] });

    const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
    const currentFrom = (accounts[0] ?? from) as Address;

    const feeField = buildFeeField(chainId, copmAddress, cusdAddress);
    const txHash = (await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: currentFrom, to: copmAddress, data, ...feeField }],
    })) as `0x${string}`;

    return txHash;
  }, [getProvider]);

  const repayCopm = useCallback(async (
    poolAddress: Address,
    creditId: `0x${string}`,
    amountCopm: string,
    from: Address,
  ): Promise<`0x${string}`> => {
    const provider = await getProvider();
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

    const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
    const currentFrom = (accounts[0] ?? from) as Address;

    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: getActiveTransport() });

    const currentAllowance = (await publicClient.readContract({
      address: copmAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [currentFrom, poolAddress],
    })) as bigint;

    if (currentAllowance < amountWei) {
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [poolAddress, amountWei],
      });

      const approveTx = (await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: currentFrom, to: copmAddress, data: approveData, ...buildFeeField(chainId, copmAddress, cusdAddress) }],
      })) as `0x${string}`;

      const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx, timeout: 60_000 });
      if (approveReceipt.status !== 'success') {
        throw new Error('No pudimos procesar tu pago. Intentá de nuevo.');
      }

      for (let i = 0; i < 15; i++) {
        const a = (await publicClient.readContract({
          address: copmAddress,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [currentFrom, poolAddress],
        })) as bigint;
        if (a >= amountWei) break;
        if (i === 14) throw new Error('El permiso (allowance) no se reflejó a tiempo. Reintenta el pago.');
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    const repayData = encodeFunctionData({
      abi: LENDING_POOL_ABI,
      functionName: 'repay',
      args: [creditId, amountWei],
    });

    const repayTx = (await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: currentFrom, to: poolAddress, data: repayData, ...buildFeeField(chainId, copmAddress, cusdAddress) }],
    })) as `0x${string}`;

    return repayTx;
  }, [getProvider]);

  return {
    isMiniPay: inMiniPay,
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
