// =============================================================================
// PruebaWallet — Página AISLADA de prueba de WalletConnect (descartable)
// =============================================================================
//
// NO toca useMiniPay / useAuth / el login real ni los pagos. Es una prueba
// autocontenida para verificar que una wallet externa conecte por
// WalletConnect (QR en desktop, deep-link en iPhone/Android).
//
// Ruta: /prueba-wallet
// Para quitarla: borrar este archivo + su <Route> en App.tsx.
//
// Requiere VITE_WC_PROJECT_ID en el .env (proyecto gratis de cloud.reown.com).
// =============================================================================

import { useRef, useState } from 'react';

const WC_PROJECT_ID = (import.meta.env?.VITE_WC_PROJECT_ID as string | undefined)?.trim() || '';

type Status = 'idle' | 'conectando' | 'conectado' | 'firmando' | 'error';

export default function PruebaWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const providerRef = useRef<any>(null);

  async function conectar() {
    setError(null);
    setSignature(null);
    setStatus('conectando');
    try {
      if (!WC_PROJECT_ID) {
        throw new Error('Falta VITE_WC_PROJECT_ID en el .env (creá un proyecto gratis en cloud.reown.com).');
      }
      // Import dinámico → el bundle de WalletConnect solo se carga acá.
      const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
      const provider = await EthereumProvider.init({
        projectId: WC_PROJECT_ID,
        metadata: {
          name: 'MANGLE — prueba',
          description: 'Prueba de conexión WalletConnect',
          url: window.location.origin,
          icons: [`${window.location.origin}/favicon.svg`],
        },
        showQrModal: true,
        // Incluimos Celo mainnet (42220) para que las wallets pueblen la lista;
        // Sepolia (11142220) para testnet.
        optionalChains: [42220, 11142220] as [number, ...number[]],
        rpcMap: {
          42220: 'https://forno.celo.org',
          11142220: 'https://forno.celo-sepolia.celo-testnet.org',
        },
      });
      providerRef.current = provider;

      const accounts = (await provider.enable()) as string[]; // abre el modal QR
      setAddress(accounts?.[0] ?? null);
      setChainId(typeof (provider as any).chainId === 'number' ? (provider as any).chainId : null);
      setStatus('conectado');
    } catch (e: any) {
      setError(e?.message || 'Error al conectar');
      setStatus('error');
    }
  }

  async function firmar() {
    if (!providerRef.current || !address) return;
    setError(null);
    setStatus('firmando');
    try {
      const msg = `Prueba MANGLE — ${new Date().toISOString()}`;
      const sig = (await providerRef.current.request({
        method: 'personal_sign',
        params: [msg, address],
      })) as string;
      setSignature(sig);
    } catch (e: any) {
      setError(e?.message || 'Error al firmar');
    } finally {
      setStatus('conectado');
    }
  }

  async function desconectar() {
    try {
      await providerRef.current?.disconnect?.();
    } catch {
      /* ignore */
    }
    providerRef.current = null;
    setAddress(null);
    setChainId(null);
    setSignature(null);
    setStatus('idle');
  }

  const conectando = status === 'conectando';

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-surface-light to-surface p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-ink/5 p-8 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-ink">Prueba WalletConnect</h1>
          <p className="text-xs text-slate-400">Página de prueba aislada · /prueba-wallet</p>
        </div>

        {!address && (
          <button
            onClick={conectar}
            disabled={conectando}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-ink hover:bg-primary disabled:opacity-60 text-white font-bold text-sm rounded-2xl shadow-md shadow-ink/10 transition-all active:scale-[0.98]"
          >
            <i className="fa-solid fa-qrcode text-sm" />
            {conectando ? 'Abriendo…' : 'Conectar con WalletConnect'}
          </button>
        )}

        {address && (
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
              disabled={status === 'firmando'}
              className="flex items-center justify-center gap-2 w-full py-3 bg-primary hover:bg-ink disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98]"
            >
              <i className="fa-solid fa-signature text-sm" />
              {status === 'firmando' ? 'Firmando…' : 'Firmar mensaje de prueba'}
            </button>

            {signature && (
              <div className="text-center space-y-1">
                <p className="text-xs font-semibold text-emerald-600">Firma OK ✅</p>
                <p className="text-[10px] font-mono text-slate-400 break-all">{signature.slice(0, 40)}…</p>
              </div>
            )}

            <button
              onClick={desconectar}
              className="w-full py-2 text-slate-400 hover:text-ink text-xs font-semibold transition-colors"
            >
              Desconectar
            </button>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 text-center leading-relaxed break-words">{error}</p>
        )}
      </div>
    </div>
  );
}
