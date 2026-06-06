// =============================================================================
// Mangle — SIWE (Sign-In with Ethereum) helpers
// =============================================================================
//
// Implements EIP-4361 message format for wallet-based authentication.
// In the MVP, nonces are generated locally. When integrating with the web
// backend, nonces should come from GET /api/auth/nonce (server-validated).
// =============================================================================

/**
 * Generate a random nonce for SIWE messages.
 * 16-character alphanumeric string.
 */
export function generateLocalNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create an EIP-4361 SIWE message.
 *
 * @param params.address  - The wallet address signing in
 * @param params.chainId  - The Celo chain ID (42220 mainnet | 44787 sepolia)
 * @param params.nonce    - Optional nonce (generated locally if omitted)
 * @returns The formatted SIWE message string ready for personal_sign
 */
export function createSiweMessage(params: {
  address: string;
  chainId: number;
  nonce?: string;
}): string {
  const domain = typeof window !== 'undefined'
    ? window.location.hostname
    : 'mangle.app';
  const uri = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://mangle.app';
  const nonce = params.nonce ?? generateLocalNonce();
  const issuedAt = new Date().toISOString();

  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    params.address,
    '',
    'Bienvenida a MANGLE. Al firmar este mensaje aceptas los términos y condiciones de la plataforma de microcréditos.',
    '',
    `URI: ${uri}`,
    'Version: 1',
    `Chain ID: ${params.chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n');
}
