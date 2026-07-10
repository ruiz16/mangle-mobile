// =============================================================================
// PruebaWallet — Página AISLADA de prueba de conexión (RainbowKit) · descartable
// =============================================================================
//
// NO toca useMiniPay / useAuth / login / pagos. Trae sus PROPIOS providers
// (WagmiProvider + RainbowKitProvider) scoped a esta página. RainbowKit embebe
// los logos de las wallets (por eso salen también en iPhone).
//
// Ruta: /prueba-wallet · Para quitarla: borrar este archivo + su <Route> en App.tsx.
// Requiere VITE_WC_PROJECT_ID (proyecto gratis de cloud.reown.com).
// =============================================================================

import '@rainbow-me/rainbowkit/styles.css';
import { useState } from 'react';
import { WagmiProvider, createConfig, http, useAccount, useSignMessage } from 'wagmi';
import { connectorsForWallets, RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import {
  valoraWallet,
  binanceWallet,
  metaMaskWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { celo, celoSepolia } from 'viem/chains';

const WC_PROJECT_ID = (import.meta.env?.VITE_WC_PROJECT_ID as string | undefined)?.trim() || '';

// Lista CURADA: solo las wallets más conocidas + WalletConnect (para cualquier
// otra). Nada de Coinbase / "Browser Wallet" genéricos.
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Billeteras',
      wallets: [valoraWallet, binanceWallet, metaMaskWallet, walletConnectWallet],
    },
  ],
  { appName: 'MANGLE — prueba', projectId: WC_PROJECT_ID },
);

const config = createConfig({
  chains: [celo, celoSepolia],
  transports: {
    [celo.id]: http('https://forno.celo.org'),
    [celoSepolia.id]: http('https://forno.celo-sepolia.celo-testnet.org'),
  },
  connectors,
  ssr: false,
});

function Inner() {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firmando, setFirmando] = useState(false);

  async function firmar() {
    setError(null);
    setFirmando(true);
    try {
      const sig = await signMessageAsync({ message: `Prueba MANGLE — ${new Date().toISOString()}` });
      setSignature(sig);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Error al firmar');
    } finally {
      setFirmando(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-surface-light to-surface p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-ink/5 p-8 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-ink">Prueba WalletConnect</h1>
          <p className="text-xs text-slate-400">Página aislada · RainbowKit · /prueba-wallet</p>
        </div>

        <div className="flex justify-center">
          <ConnectButton />
        </div>

        {isConnected && address && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Conectado ✅</p>
              <p className="text-sm font-mono text-ink break-all">{address}</p>
              {chainId != null && (
                <p className="text-xs text-slate-500">
                  Chain ID: <strong>{chainId}</strong>{' '}
                  {chainId === 42220 ? '(Celo mainnet)' : chainId === 11142220 ? '(Celo Sepolia)' : ''}
                </p>
              )}
            </div>

            <button
              onClick={firmar}
              disabled={firmando}
              className="flex items-center justify-center gap-2 w-full py-3 bg-primary hover:bg-ink disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98]"
            >
              <i className="fa-solid fa-signature text-sm" />
              {firmando ? 'Firmando…' : 'Firmar mensaje de prueba'}
            </button>

            {signature && (
              <div className="text-center space-y-1">
                <p className="text-xs font-semibold text-emerald-600">Firma OK ✅</p>
                <p className="text-[10px] font-mono text-slate-400 break-all">{signature.slice(0, 40)}…</p>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-500 text-center leading-relaxed break-words">{error}</p>}
      </div>
    </div>
  );
}

export default function PruebaWallet() {
  return (
    <WagmiProvider config={config}>
      <RainbowKitProvider modalSize="compact">
        <Inner />
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
