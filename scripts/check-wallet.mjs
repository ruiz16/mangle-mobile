// =============================================================================
// Diagnóstico de billetera: ¿qué contrato usa la app y cuánto hay?
// -----------------------------------------------------------------------------
// Lee las direcciones reales de tu .env.local (VITE_*) y consulta el saldo de
// COPm y USDm de una dirección en MAINNET y en SEPOLIA (testnet).
//
//   node scripts/check-wallet.mjs [direccion]
//   (sin argumento usa 0x6C84eeaB621A521484D51Bc82d9E58a65336fc53)
// =============================================================================
import { readFileSync } from 'fs';
import { createPublicClient, http, formatUnits, getAddress } from 'viem';

const TARGET = getAddress(process.argv[2] || '0x6C84eeaB621A521484D51Bc82d9E58a65336fc53');

// --- Parse .env.local (y .env) sin depender de dotenv ---
function loadEnv() {
  const env = {};
  for (const file of ['.env', '.env.local']) {
    try {
      const raw = readFileSync(file, 'utf8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      }
    } catch { /* archivo no existe */ }
  }
  return env;
}

const env = loadEnv();
const active = env.VITE_CELO_NETWORK || '(no seteada)';
console.log(`\nVITE_CELO_NETWORK activa: ${active}`);
console.log(`Billetera consultada    : ${TARGET}\n`);

const ERC20 = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'string' }] },
];

const NETS = [
  {
    label: 'MAINNET',
    rpc: env.VITE_CELO_MAINNET_RPC || 'https://forno.celo.org',
    copm: env.VITE_COPM_MAINNET,
    usdm: env.VITE_CUSD_MAINNET,
    pool: env.VITE_LENDING_POOL_MAINNET,
  },
  {
    label: 'SEPOLIA (testnet)',
    rpc: env.VITE_CELO_SEPOLIA_RPC || 'https://forno.celo-sepolia.celo-testnet.org',
    copm: env.VITE_COPM_SEPOLIA,
    usdm: env.VITE_CUSD_SEPOLIA,
    pool: env.VITE_LENDING_POOL_SEPOLIA,
  },
];

async function bal(client, token, who) {
  try {
    const [b, sym] = await Promise.all([
      client.readContract({ address: token, abi: ERC20, functionName: 'balanceOf', args: [who] }),
      client.readContract({ address: token, abi: ERC20, functionName: 'symbol' }).catch(() => '?'),
    ]);
    return `${formatUnits(b, 18)}  (${sym})`;
  } catch (e) {
    return `error: ${(e.shortMessage || e.message).split('\n')[0]}`;
  }
}

for (const n of NETS) {
  console.log('='.repeat(60));
  console.log(`${n.label}  — RPC ${n.rpc}`);
  console.log(`  COPm contrato: ${n.copm || '(falta en env)'}`);
  console.log(`  USDm contrato: ${n.usdm || '(falta en env)'}`);
  console.log(`  Pool contrato: ${n.pool || '(falta en env)'}`);
  if (!n.copm && !n.usdm) { console.log('  (sin direcciones en env — salto)\n'); continue; }
  const client = createPublicClient({ transport: http(n.rpc) });
  if (n.copm) console.log(`  Saldo COPm: ${await bal(client, getAddress(n.copm), TARGET)}`);
  if (n.usdm) console.log(`  Saldo USDm: ${await bal(client, getAddress(n.usdm), TARGET)}`);
  console.log('');
}
