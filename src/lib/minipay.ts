// =============================================================================
// minipay — Detección de MiniPay + auto-connect
// =============================================================================
// MiniPay inyecta window.ethereum y espera auto-conexión sin botón.
// `?minipay=1` (solo en dev) fuerza la detección para probar sin la app real.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { useAccount, useConnect } from 'wagmi';

export function isMiniPay(): boolean {
  if (typeof window === 'undefined') return false;
  if (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('minipay') === '1'
  ) {
    return true;
  }
  const eth = (window as { ethereum?: { isMiniPay?: boolean } }).ethereum;
  return Boolean(eth?.isMiniPay);
}

/** Hook estable (false en SSR/primer paint, luego true si estamos en MiniPay). */
export function useIsMiniPay(): boolean {
  const [inMiniPay, setInMiniPay] = useState(false);
  useEffect(() => {
    setInMiniPay(isMiniPay());
  }, []);
  return inMiniPay;
}

/** Dentro de MiniPay: auto-conecta el connector injected (conexión implícita). */
export function useMiniPayAutoConnect(): void {
  const { isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const triedRef = useRef(false);

  useEffect(() => {
    if (triedRef.current || isConnected) return;
    if (!isMiniPay()) return;
    const injected = connectors.find((c) => c.type === 'injected');
    if (!injected) return;
    triedRef.current = true;
    connect({ connector: injected });
  }, [connectors, connect, isConnected]);
}
