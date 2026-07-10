# MiniPay Origin Manifest — Mangle Mini App

> **Qué es esto:** MiniPay (Stage-2 de listado) exige un manifiesto de **todos los
> orígenes/URLs** que la mini app llama (JS, CSS, fuentes, RPCs, APIs) y un header
> **Content-Security-Policy (CSP)** que los restrinja. Sirve para que MiniPay evalúe
> el riesgo de cadena de suministro (supply-chain).
>
> **Regla de oro:** este documento y el `Content-Security-Policy` de `vercel.json`
> deben estar SIEMPRE sincronizados. Si agregás un origen nuevo (otro RPC, una CDN,
> una API), actualizá AMBOS.

App: **Mangle** (Vite SPA, se carga dentro del WebView de MiniPay)
Hosting: Vercel (`vercel.json`)

---

## 1. Orígenes que la app llama

### Self

| Origen                       | Uso                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `'self'` (dominio de deploy) | HTML, JS y CSS propios (bundle de Vite), assets locales (logo, Lottie, favicon) |

### CSS / Fuentes (declarados en `index.html`)

| Origen                         | Uso                                                    |
| ------------------------------ | ------------------------------------------------------ |
| `https://cdnjs.cloudflare.com` | Font Awesome 6.4.0 (CSS + webfonts de íconos `fa-*`)   |
| `https://fonts.googleapis.com` | Hoja de estilos de Google Fonts (Amaranth, Montserrat) |
| `https://fonts.gstatic.com`    | Archivos de fuente (woff2) de Google Fonts             |

### API backend (env `VITE_API_URL`)

| Origen                                | Uso                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `https://mangle-dashboard.vercel.app` | Backend Next.js de Mangle: auth MiniPay, `/api/pago`, cuotas, créditos, GACC |

### RPC de Celo (env `VITE_CELO_*_RPC` + `*_RPC_FALLBACKS`)

| Origen                                        | Uso                                                  |
| --------------------------------------------- | ---------------------------------------------------- |
| `https://forno.celo.org`                      | RPC mainnet (lecturas: recibos, balances, allowance) |
| `https://forno.celo-sepolia.celo-testnet.org` | RPC testnet (Sepolia)                                |

> ⚠️ El RPC mainnet correcto es **`https://forno.celo.org`**. NO usar
> `https://forno.celo-mainnet.celo-testnet.org` (no responde — verificado). Si agregás
> un fallback de Alchemy/dRPC vía `*_RPC_FALLBACKS`, sumá su dominio a `connect-src`.

### Wallet

| Origen                                  | Uso                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `window.ethereum` (proveedor inyectado) | MiniPay/MetaMask. NO es un origen de red → no va en CSP. Las ESCRITURAS van por la wallet. |

### Navegación externa (deeplinks — no son fetch)

| Origen                                         | Uso                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `https://link.minipay.xyz`                     | Deeplink "Add Cash" si se agrega flujo de recarga (ver nota COPm abajo) |
| `https://metamask.io`, `https://www.opera.com` | Enlaces informativos en la pantalla Connect                             |

---

## 2. Content-Security-Policy (pegar en `vercel.json`)

El CSP ya está aplicado en `mangle-mobile/vercel.json` con los dominios reales. Si
agregás un origen nuevo (otro RPC, una CDN, otra API), debe ir en `connect-src`/
`style-src`/`font-src`; si falta, **la app se romperá** al llamarlo (comportamiento
esperado del CSP). Este es el bloque vigente:

```jsonc
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data:; connect-src 'self' https://mangle-dashboard.vercel.app https://forno.celo.org https://forno.celo-sepolia.celo-testnet.org; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'",
        },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin",
        },
        { "key": "X-Frame-Options", "value": "DENY" },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=63072000; includeSubDomains; preload",
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
        },
      ],
    },
  ],
}
```

Notas del CSP:

- `style-src 'unsafe-inline'`: necesario porque la app usa estilos inline (`style={{...}}`)
  y Tailwind. Es la única concesión; el resto queda estricto.
- `script-src 'self'`: el bundle de Vite no carga scripts externos. No se permite `eval`.
- `connect-src`: incluí AQUÍ todos los RPC y la API. Si agregás un fallback de Alchemy,
  sumá su dominio (ej. `https://celo-mainnet.g.alchemy.com`).
- `frame-ancestors 'none'` + `X-Frame-Options DENY`: MiniPay carga en WebView (no iframe),
  así que bloquear iframes es seguro y recomendado.

---

## 3. Verificación

1. Deploy a Vercel y comparar el header real contra esta lista:
   ```bash
   curl -sI https://<TU-DOMINIO> | grep -i content-security-policy
   ```
2. Abrir la mini app en MiniPay (modo desarrollador) y confirmar que:
   - Cargan fuentes e íconos (FontAwesome, Google Fonts).
   - Las llamadas a la API y a los RPC funcionan (pagos, balances).
   - La consola del WebView no muestra violaciones de CSP (`Refused to connect/load`).
3. Si algo se bloquea: el dominio falta en `connect-src`/`style-src`/`font-src` →
   agregarlo AQUÍ y en `vercel.json` (mantener sincronizado).

---

## 4. Nota importante sobre "Add Cash" y COPm

El deeplink `https://link.minipay.xyz/add_cash?tokens=USDT,USDC,USDm` **solo soporta
USDT/USDC/USDm**, NO COPm. Por eso un flujo "sin fondos → recargar" NO puede recargar
COPm directamente vía MiniPay. Para COPm, recargar implica conseguir USDC y swapear a
COPm (Mento), lo cual no es un flujo nativo de MiniPay. Tenerlo presente al diseñar el
modal de "Necesitás más COPm" (hoy solo informa; no enlaza a add_cash porque no aplica
a COPm).
