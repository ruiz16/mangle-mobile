# Diseño: Módulo Wallet (COPm en vivo)

**Fecha:** 2026-06-29
**Proyecto:** mangle-mobile
**Estado:** Aprobado para planificación

---

## 1. Objetivo

Dar a la usuaria un espacio para ver su saldo de **COPm en vivo**, como una wallet.
El saldo se lee **directamente on-chain** (Celo, vía `viem`), reusando la
infraestructura de red resiliente y de server-state que ya existe en la app.

## 2. Decisión de arquitectura (Screaming Architecture)

`wallet` es un **dominio independiente**. Los COPm NO tienen relación con las
credenciales (decisión confirmada con el usuario). Por tanto NO se anida bajo
`credential/`. La estructura del código grita "wallet" como dominio propio,
al lado de `creditos`, `cuotas`, `perfil`.

Evidencia de que la arquitectura ya lo anticipaba: `queries/client.ts` ya define
`copmBalance: (address) => ['copm-balance', address]` sin un consumidor todavía.

**Navegación ≠ acoplamiento.** Que el saldo se vea cerca de otras pantallas es
una decisión de UI; la separación de dominios es una decisión de código. Son
capas distintas.

## 3. Archivos

| Archivo | Propósito | Acción |
|---|---|---|
| `src/queries/wallet.ts` | Server-state del saldo COPm (`useCopmBalance`) | **Nuevo** |
| `src/pages/Wallet.tsx` | Página `/wallet` | **Nuevo** |
| `src/components/WalletChip.tsx` | Chip de saldo, navega a `/wallet` | **Nuevo** |
| `src/App.tsx` | Ruta `/wallet` + montar `WalletChip` en páginas de dinero | Editar |
| `src/pages/Credential.tsx` | Card de entrada a `/wallet` | Editar |

NO se modifica `hooks/useMiniPay.ts`: ese hook es para CONEXIÓN y ESCRITURAS
(`sendCopm`, `repayCopm`). Las lecturas reactivas del saldo son server-state y
viven en TanStack Query.

## 4. Lectura del saldo: `useCopmBalance` (queries/wallet.ts)

```ts
export function useCopmBalance() {
  const { state } = useAppState();
  const address = state.walletAddress;
  return useQuery({
    queryKey: queryKeys.copmBalance(address),
    enabled: !!address,
    queryFn: () => readCopmBalanceOf(address as Address), // usa getActiveTransport()
    refetchInterval: 30_000,          // red de seguridad para ingresos externos
    refetchOnWindowFocus: true,       // ya es default global en client.ts
  });
}
```

`readCopmBalanceOf` crea un `publicClient` con `getActiveTransport()` (el
transporte `fallback()` + retries que ya existe en `lib/network.ts`) y resuelve
la dirección del token con `resolveContractAddresses(ACTIVE_CHAIN.id)`.
Reusa `ERC20_ABI` (`balanceOf`) — extraerlo a un módulo compartido si conviene,
o redeclarar el fragmento mínimo en `wallet.ts`.

## 5. Estrategia de refresco ("tiempo real")

Celo tiene block time ~1s; no existe saldo "más en vivo" que el tiempo de bloque.
El template oficial de balance de MiniPay es **event-driven** (refresca on-mount
y tras cada acción), NO polling agresivo. Se adopta ese patrón:

| Disparador | Mecanismo | Justificación |
|---|---|---|
| Entrar a `/wallet` / volver el foco | `refetchOnWindowFocus` (default en `client.ts`) | = `refreshBalance` on-mount del template MiniPay |
| Tras `sendCopm` / `repayCopm` OK | `queryClient.invalidateQueries({ queryKey: ['copm-balance'] })` | refresco instantáneo event-driven |
| Ingreso externo (red de seguridad) | `refetchInterval: 30_000` | alineado con el 30s de celopedia; respeta batería |

Se descarta `watchContractEvent` (WebSocket): frágil en móvil/MiniPay (el socket
se cae al bloquear pantalla, drena batería). Se descarta backend/indexer: el
usuario lee directo on-chain.

**Acción de plan:** en los handlers de éxito de `sendCopm`/`repayCopm`
(pantallas `Request`/`Repayment`) agregar la invalidación de `['copm-balance']`.

## 6. Navegación: dos puertas

1. **`WalletChip`** — montado en `App.tsx`/`MobileShell`, visible SOLO en
   páginas de dinero: **`/request`**, **`/repayment`** y **`/wallet`**.
   Muestra `formatCopmBalance(balance)` (ya existe en `lib/currency.ts`).
   `onClick → navigate('/wallet')`. Maneja loading (skeleton) y `isFetching`
   (indicador sutil de "actualizando").
2. **Card en `Credential.tsx`** — punto de entrada explícito que navega a
   `/wallet`. La page es independiente; solo es otra puerta.

## 7. Página `/wallet`

- Ruta nueva en `App.tsx`, dentro de `MobileShell showNav={true}`.
- Contenido v1:
  - Saldo grande en vivo (`formatCopmBalance`).
  - Dirección con botón "copiar".
  - Estado de red (mainnet/sepolia) desde `ACTIVE_NETWORK`.
  - Estados `isLoading` / `error` / `isFetching`.
- **Copy MiniPay:** usar "Saldo", "Stablecoin"/"COPm"; evitar términos prohibidos
  ("crypto", "gas", "onramp"). Nunca mostrar CELO.

## 8. Estados y errores

- **Sin wallet conectada** (`!walletAddress`): CTA "Conectá tu wallet" →
  reusa flujo `/connect`. La query queda `enabled: false`.
- **Error de RPC:** `getActiveTransport()` ya rota nodos con `fallback()`. Si
  todos fallan, TanStack Query conserva el último saldo cacheado; mostrar aviso
  sutil "no pudimos refrescar" sin borrar el valor previo.

## 9. Fuera de alcance (YAGNI)

- **Historial de transacciones:** requiere indexer / paginación de eventos
  (`eth_getLogs` limitado a ~2000 bloques en RPC público). Confirmado fuera de v1.
- Multi-token, swaps, on/off-ramp: no.

## 10. Dependencias nuevas

Ninguna. Reusa `viem`, `@tanstack/react-query`, `wouter`, `clsx`, Tailwind y
todos los helpers existentes (`network.ts`, `currency.ts`, `AppState`).
