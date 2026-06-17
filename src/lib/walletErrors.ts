// =============================================================================
// friendlyWalletError — convierte errores crudos de wallet/RPC/viem en mensajes
// claros en español. NUNCA devuelve el JSON crudo del RPC al usuario.
// =============================================================================

/** Extrae un texto buscable de las distintas formas de error de viem/EIP-1193. */
function collectText(err: any): string {
  if (!err) return '';
  const parts = [
    err.shortMessage,
    err.details,
    err.reason,
    err.cause?.shortMessage,
    err.cause?.message,
    typeof err.message === 'string' ? err.message : '',
  ].filter(Boolean);
  return parts.join(' \n ').toLowerCase();
}

/** ¿El string parece un volcado JSON/objeto crudo? (para no mostrarlo nunca) */
function looksLikeRawDump(s: string): boolean {
  if (!s) return true;
  const t = s.trim();
  return t.startsWith('{') || t.startsWith('[') || t.includes('"jsonrpc"') || t.length > 160;
}

/**
 * Traduce un error de pago/wallet a un mensaje corto y humano.
 * @param err  error capturado (viem, EIP-1193, RPC, etc.)
 */
export function friendlyWalletError(err: any): string {
  // 1. Usuario canceló
  if (err?.code === 4001 || err?.code === 'ACTION_REJECTED') {
    return 'Cancelaste la transacción en tu wallet.';
  }

  const text = collectText(err);

  // 2. Cancelación por texto
  if (text.includes('user rejected') || text.includes('denied') || text.includes('rechaz')) {
    return 'Cancelaste la transacción en tu wallet.';
  }

  // Mostrar log pero en terminal de vite
  try {
    // Enviamos el log al plugin de vite para verlo en la terminal, incluso usando ngrok
    fetch('/api/log', { method: 'POST', body: text }).catch(() => { });
  } catch (e) { }

  // 3. Saldo insuficiente (COPm) — el caso "sin fondos"
  if (
    text.includes('insufficient funds') ||
    text.includes('exceeds balance') ||
    text.includes('transfer amount exceeds') ||
    text.includes('insufficient balance')
  ) {
    return 'No tenés suficiente COPm para pagar esta cuota (incluye una pequeña comisión de red en COPm). Recargá COPm e intentá de nuevo.';
  }

  // 4. Fee currency no válido (típico en testnet con un token que no es fee currency)
  if (text.includes('fee currency') || text.includes('feecurrency') || text.includes('not whitelisted')) {
    return 'Esta red no permite pagar el gas con COPm. Probá desde MiniPay en mainnet, o usá una wallet con CELO para el gas.';
  }

  // 5. Conexión / RPC / timeout
  if (text.includes('timeout') || text.includes('network') || text.includes('fetch') || text.includes('connection')) {
    return 'Problema de conexión con la red. Revisá tu internet e intentá de nuevo.';
  }

  // 6. Reverted genérico
  if (text.includes('revert')) {
    return 'La transacción fue rechazada por la blockchain. Revisá tu saldo e intentá de nuevo.';
  }

  // 7. Fallback: usar shortMessage SOLO si es corto y legible; si no, genérico.
  const short = err?.shortMessage;
  if (typeof short === 'string' && !looksLikeRawDump(short)) return short;

  return 'No se pudo procesar el pago. Intentá de nuevo en unos minutos.';
}
