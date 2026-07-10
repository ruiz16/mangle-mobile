// =============================================================================
// wagmi + RainbowKit config (compartida)
// =============================================================================
// Lista CURADA de wallets (alfabética): Binance, Trust, Valora, WalletConnect.
// MetaMask/Rabby/otras entran por WalletConnect. Adentro de MiniPay se
// auto-conecta el connector injected (ver lib/minipay.ts).
// IMPORTANTE: createConfig se importa de `wagmi`.
// =============================================================================

import { createConfig, http } from 'wagmi';
import { celo, celoSepolia } from 'viem/chains';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  injectedWallet,
  binanceWallet,
  trustWallet,
  valoraWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { ACTIVE_NETWORK, getActiveTransport } from './network';

const WC_PROJECT_ID = (import.meta.env?.VITE_WC_PROJECT_ID as string | undefined)?.trim() || '';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Billeteras',
      // injectedWallet: solo aparece si hay extensión inyectada (desktop) →
      // conecta MetaMask/Rabby/etc directo; en mobile Safari queda oculto.
      wallets: [injectedWallet, binanceWallet, trustWallet, valoraWallet, walletConnectWallet],
    },
  ],
  { appName: 'MANGLE', projectId: WC_PROJECT_ID },
);

const FORNO_MAINNET = 'https://forno.celo.org';
const FORNO_SEPOLIA = 'https://forno.celo-sepolia.celo-testnet.org';

const chains = ACTIVE_NETWORK === 'mainnet' ? ([celo, celoSepolia] as const) : ([celoSepolia, celo] as const);

export const wagmiConfig = createConfig({
  chains,
  transports: {
    [celo.id]: ACTIVE_NETWORK === 'mainnet' ? getActiveTransport() : http(FORNO_MAINNET),
    [celoSepolia.id]: ACTIVE_NETWORK === 'sepolia' ? getActiveTransport() : http(FORNO_SEPOLIA),
  },
  connectors,
  ssr: false,
});
