# Wallet COPm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a la usuaria un módulo wallet independiente para ver su saldo de COPm en vivo, leído directamente on-chain.

**Architecture:** `wallet` es un dominio propio (no anidado en `credential`). El saldo es server-state vía TanStack Query (`useCopmBalance`), leído con el transporte resiliente `getActiveTransport()` que ya existe. Refresco event-driven (focus + invalidación tras pagos) con `refetchInterval` suave de 30s como red de seguridad.

**Tech Stack:** React 19, Vite, TypeScript, `viem`, `@tanstack/react-query`, `wouter`, Tailwind. Verificación MANUAL (el proyecto no tiene runner de tests).

## Global Constraints

- **Sin dependencias nuevas.** Reusar `viem`, `@tanstack/react-query`, `wouter`, Tailwind y helpers existentes.
- **Verificación manual** con `npm run dev` + navegador/MiniPay. NO correr `npm run build` (regla del proyecto: nunca buildear).
- **NO modificar `hooks/useMiniPay.ts`** — es para conexión/escrituras. Las lecturas reactivas son server-state.
- **Copy MiniPay:** usar "Saldo", "COPm"; NUNCA mostrar CELO ni términos prohibidos ("crypto", "gas", "onramp").
- **Commits convencionales**, sin co-author ni atribución AI.
- COPm tiene 18 decimales. Formatear SIEMPRE con `formatCopmBalance` de `lib/currency.ts`.

---

### Task 1: Query del saldo — `useCopmBalance`

**Files:**
- Create: `src/queries/wallet.ts`

**Interfaces:**
- Consumes: `getActiveChain`, `getActiveTransport`, `resolveContractAddresses` de `lib/network.ts`; `queryKeys.copmBalance` de `queries/client.ts`; `useAppState` de `context/AppState`.
- Produces: `readCopmBalanceOf(address: Address): Promise<bigint>` y `useCopmBalance(): UseQueryResult<bigint>`.

- [ ] **Step 1: Crear `src/queries/wallet.ts`**

```ts
// =============================================================================
// Wallet — saldo COPm on-chain como server-state (TanStack Query)
// =============================================================================
//
// Lecturas reactivas del saldo. NO usa useMiniPay (ese es para conexión y
// escrituras). Reusa el transporte resiliente fallback() de lib/network.ts.
// =============================================================================

import { useQuery } from '@tanstack/react-query';
import { createPublicClient } from 'viem';
import type { Address } from 'viem';
import { getActiveChain, getActiveTransport, resolveContractAddresses } from '../lib/network';
import { useAppState } from '../context/AppState';
import { queryKeys } from './client';

const BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/** Lee el saldo COPm fresco on-chain de una dirección. */
export async function readCopmBalanceOf(address: Address): Promise<bigint> {
  const chain = getActiveChain();
  const publicClient = createPublicClient({ chain, transport: getActiveTransport() });
  const { copmAddress } = resolveContractAddresses(chain.id);
  return publicClient.readContract({
    address: copmAddress,
    abi: BALANCE_ABI,
    functionName: 'balanceOf',
    args: [address],
  }) as Promise<bigint>;
}

/**
 * Saldo COPm de la usuaria conectada, como server-state.
 * Refresco: event-driven (focus + invalidación tras pago) + 30s de red de
 * seguridad para ingresos externos.
 */
export function useCopmBalance() {
  const { state } = useAppState();
  const address = state.walletAddress as Address | null;
  return useQuery({
    queryKey: queryKeys.copmBalance(address),
    enabled: !!address,
    queryFn: () => readCopmBalanceOf(address as Address),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}
```

- [ ] **Step 2: Verificar typecheck del editor**

No hay runner de tests. Confirmar en el editor (TS server) que `src/queries/wallet.ts` no marca errores de tipos ni imports rotos. NO correr `npm run build`.

- [ ] **Step 3: Commit**

```bash
git add src/queries/wallet.ts
git commit -m "feat(wallet): add useCopmBalance on-chain query"
```

---

### Task 2: Componente `WalletChip`

**Files:**
- Create: `src/components/WalletChip.tsx`

**Interfaces:**
- Consumes: `useCopmBalance` de `queries/wallet.ts`; `formatCopmBalance` de `lib/currency.ts`; `useLocation` de `wouter`.
- Produces: `default export WalletChip()` — botón que navega a `/wallet`.

- [ ] **Step 1: Crear `src/components/WalletChip.tsx`**

```tsx
import { useLocation } from 'wouter';
import { useCopmBalance } from '../queries/wallet';
import { formatCopmBalance } from '../lib/currency';

/** Chip de saldo COPm. Visible en páginas de dinero; abre /wallet al tocar. */
export default function WalletChip() {
  const [, navigate] = useLocation();
  const { data: balance, isLoading, isFetching } = useCopmBalance();

  return (
    <button
      onClick={() => navigate('/wallet')}
      className="flex items-center gap-2 rounded-full bg-white/90 backdrop-blur border border-slate-100 shadow-sm pl-3 pr-3.5 py-1.5 active:scale-95 transition"
      aria-label="Ver mi saldo COPm"
    >
      <i className="fa-solid fa-wallet text-primary text-xs" />
      <span className="text-xs font-bold text-ink tabular-nums">
        {isLoading ? '···' : balance != null ? formatCopmBalance(balance) : '—'}
      </span>
      {isFetching && !isLoading && (
        <i className="fa-solid fa-circle-notch fa-spin text-[9px] text-slate-400" />
      )}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WalletChip.tsx
git commit -m "feat(wallet): add WalletChip balance component"
```

(Verificación visual diferida a la Task 4, cuando el chip se monta.)

---

### Task 3: Página `/wallet`

**Files:**
- Create: `src/pages/Wallet.tsx`
- Modify: `src/App.tsx` (import + ruta)

**Interfaces:**
- Consumes: `useCopmBalance` de `queries/wallet.ts`; `formatCopmBalance` de `lib/currency.ts`; `ACTIVE_NETWORK` de `lib/network.ts`; `useAppState`; `PageHeader`; `useLocation`.
- Produces: `default export Wallet()`; ruta `/wallet` registrada.

- [ ] **Step 1: Crear `src/pages/Wallet.tsx`**

```tsx
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppState } from '../context/AppState';
import { useCopmBalance } from '../queries/wallet';
import { formatCopmBalance } from '../lib/currency';
import { ACTIVE_NETWORK } from '../lib/network';
import PageHeader from '../components/PageHeader';

export default function Wallet() {
  const { state } = useAppState();
  const [, navigate] = useLocation();
  const { data: balance, isLoading, isError, isFetching, refetch } = useCopmBalance();
  const [copied, setCopied] = useState(false);
  const address = state.walletAddress;

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!address) {
    return (
      <div className="flex-1 flex flex-col p-5 gap-6">
        <PageHeader title="Tu Wallet" subtitle="Saldo COPm" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <i className="fa-solid fa-wallet text-4xl text-slate-300" />
          <p className="text-sm text-slate-500">Conectá tu wallet para ver tu saldo.</p>
          <button
            onClick={() => navigate('/connect')}
            className="rounded-full bg-primary text-white text-sm font-bold px-6 py-2.5"
          >
            Conectar wallet
          </button>
        </div>
      </div>
    );
  }

  const truncated = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const netLabel = ACTIVE_NETWORK === 'mainnet' ? 'Celo' : 'Celo Sepolia (prueba)';

  return (
    <div className="flex-1 flex flex-col p-5 gap-6">
      <PageHeader title="Tu Wallet" subtitle="Saldo COPm" />

      {/* Saldo en vivo */}
      <div className="rounded-3xl p-6 bg-white border border-slate-100 shadow-sm flex flex-col items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-slate-400">Saldo disponible</span>
        <span className="text-4xl font-black text-ink tabular-nums">
          {isLoading ? '···' : balance != null ? formatCopmBalance(balance) : '—'}
        </span>
        <span className="text-xs text-slate-400">COPm</span>
        {isFetching && !isLoading && (
          <span className="text-[10px] text-slate-400">
            <i className="fa-solid fa-circle-notch fa-spin mr-1" />Actualizando…
          </span>
        )}
        {isError && (
          <button onClick={() => refetch()} className="text-[11px] text-orange-500 mt-1">
            No pudimos refrescar. Reintentar
          </button>
        )}
      </div>

      {/* Dirección */}
      <button
        onClick={copy}
        className="flex items-center justify-between rounded-2xl p-4 bg-white border border-slate-100 shadow-sm"
      >
        <div className="flex flex-col items-start">
          <span className="text-[9px] uppercase tracking-wider text-slate-400">Tu dirección</span>
          <span className="text-xs font-mono text-slate-700">{truncated}</span>
        </div>
        <i className={`fa-solid ${copied ? 'fa-check text-green-500' : 'fa-copy text-slate-400'} text-sm`} />
      </button>

      {/* Red */}
      <div className="flex items-center justify-between rounded-2xl p-4 bg-white border border-slate-100 shadow-sm">
        <span className="text-[9px] uppercase tracking-wider text-slate-400">Red</span>
        <span className="text-xs font-semibold text-slate-700">{netLabel}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Registrar la ruta en `src/App.tsx`**

Añadir el import junto a los demás imports de páginas:

```tsx
import Wallet from './pages/Wallet';
```

Añadir la ruta dentro del `<Switch>`, junto a `/credential` (con `showNav={true}`):

```tsx
<Route path="/wallet">
  <MobileShell showNav={true}>
    <Wallet />
  </MobileShell>
</Route>
```

- [ ] **Step 3: Verificación manual**

```bash
npm run dev
```
Navegar a `/wallet`. Esperado: con wallet conectada se ve el saldo (formato `$x.xxx,xx`), la dirección truncada (copiar funciona) y la red. Sin wallet conectada, se ve el CTA "Conectar wallet".

- [ ] **Step 4: Commit**

```bash
git add src/pages/Wallet.tsx src/App.tsx
git commit -m "feat(wallet): add /wallet page with live COPm balance"
```

---

### Task 4: Montar `WalletChip` en páginas de dinero

**Files:**
- Modify: `src/App.tsx` (import + render en `MobileShell`)

**Interfaces:**
- Consumes: `WalletChip` de `components/WalletChip.tsx`; `location` de `useLocation` (ya disponible en `MobileShell`).
- Produces: chip flotante visible solo en `/request`, `/repayment`, `/wallet`.

- [ ] **Step 1: Importar el chip en `src/App.tsx`**

Junto a los imports de componentes (`BottomNav`, `Toast`, etc.):

```tsx
import WalletChip from './components/WalletChip';
```

- [ ] **Step 2: Definir las rutas de dinero (nivel de módulo, fuera del componente)**

```tsx
const MONEY_ROUTES = ['/request', '/repayment', '/wallet'];
```

- [ ] **Step 3: Renderizar el chip dentro de `MobileShell`**

En `MobileShell`, el contenedor raíz ya es `relative` y ya existe `const [location] = useLocation();`. Añadir el chip flotante como primer hijo del contenedor raíz, antes del bloque de contenido:

```tsx
{showNav && MONEY_ROUTES.includes(location) && (
  <div className="absolute top-3 right-4 z-30">
    <WalletChip />
  </div>
)}
```

- [ ] **Step 4: Verificación manual**

```bash
npm run dev
```
Esperado: el chip de saldo aparece arriba a la derecha SOLO en `/request`, `/repayment` y `/wallet`. NO aparece en `/education`, `/gacc`, `/credential`. Tocarlo navega a `/wallet`.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(wallet): show WalletChip on money routes"
```

---

### Task 5: Card de entrada a la wallet en `Credential`

**Files:**
- Modify: `src/pages/Credential.tsx` (import `useLocation` + card)

**Interfaces:**
- Consumes: `useLocation` de `wouter`.
- Produces: card que navega a `/wallet`.

- [ ] **Step 1: Importar `useLocation` en `src/pages/Credential.tsx`**

Añadir al inicio:

```tsx
import { useLocation } from 'wouter';
```

Dentro del componente `Credential`, junto a los demás hooks:

```tsx
const [, navigate] = useLocation();
```

- [ ] **Step 2: Añadir la card de entrada**

Insertar DESPUÉS del bloque `{/* Stats cards */}` (el `grid grid-cols-3`) y ANTES del párrafo explicativo `<p className="text-[10px] ...">`:

```tsx
{/* Entrada a la wallet */}
<button
  onClick={() => navigate('/wallet')}
  className="flex items-center justify-between rounded-2xl p-4 bg-white border border-slate-100 shadow-sm active:scale-[0.98] transition"
>
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
      <i className="fa-solid fa-wallet text-primary text-sm" />
    </div>
    <div className="flex flex-col items-start">
      <span className="text-xs font-bold text-ink">Tu Wallet</span>
      <span className="text-[10px] text-slate-400">Ver tu saldo COPm</span>
    </div>
  </div>
  <i className="fa-solid fa-chevron-right text-slate-300 text-xs" />
</button>
```

- [ ] **Step 3: Verificación manual**

```bash
npm run dev
```
Navegar a `/credential`. Esperado: bajo las stats aparece la card "Tu Wallet"; tocarla navega a `/wallet`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Credential.tsx
git commit -m "feat(wallet): add wallet entry card in Credential"
```

---

### Task 6: Invalidar el saldo tras pagar en `Repayment`

**Files:**
- Modify: `src/pages/Repayment.tsx:183-185` (zona de invalidaciones tras pago)

**Interfaces:**
- Consumes: `queryClient` (ya instanciado vía `useQueryClient` en `Repayment.tsx:158`).
- Produces: refresco instantáneo del saldo COPm tras `sendCopm`/`repayCopm` exitoso.

- [ ] **Step 1: Añadir la invalidación**

En el bloque que ya invalida `creditos`/`cuotas`/`score` (≈ líneas 183-185), añadir:

```tsx
queryClient.invalidateQueries({ queryKey: ['copm-balance'] });
```

Se invalida por prefijo `['copm-balance']` (cubre cualquier address). Es deliberado: tras un pago, el saldo cambió on-chain y debe refrescarse al instante sin esperar el intervalo de 30s.

- [ ] **Step 2: Verificación manual**

```bash
npm run dev
```
Hacer un pago de cuota en `/repayment` (testnet). Esperado: tras la tx exitosa, el chip de saldo y la página `/wallet` reflejan el saldo descontado sin esperar 30s.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Repayment.tsx
git commit -m "feat(wallet): refresh COPm balance after repayment"
```

---

## Self-Review

**Spec coverage:**
- §2 dominio independiente → Tasks 1-3 (archivos separados). ✓
- §4 `useCopmBalance` → Task 1. ✓
- §5 refresco event-driven + 30s + invalidación tras pago → Task 1 (`refetchInterval`/`refetchOnWindowFocus`) + Task 6 (invalidación). ✓ (Corrección vs spec: la invalidación va SOLO en `Repayment`; `Request` no usa `sendCopm`/`repayCopm`.)
- §6 dos puertas (chip + card) → Task 4 (chip en `/request`,`/repayment`,`/wallet`) + Task 5 (card en Credential). ✓
- §7 página `/wallet` (saldo, dirección+copiar, red, estados) → Task 3. ✓
- §8 estados/errores (sin wallet → CTA; error RPC → reintentar) → Task 3. ✓
- §9 YAGNI (sin historial) → no se implementa. ✓
- §10 sin deps nuevas → ninguna añadida. ✓

**Placeholder scan:** sin TBD/TODO; todo el código está completo.

**Type consistency:** `readCopmBalanceOf(address: Address): Promise<bigint>` y `useCopmBalance()` consistentes entre Task 1 (definición) y Tasks 2-3 (consumo). `formatCopmBalance(balance: bigint)` usado igual en chip y página. Key `['copm-balance']` consistente entre `queryKeys.copmBalance` (prefijo) y la invalidación de Task 6.
