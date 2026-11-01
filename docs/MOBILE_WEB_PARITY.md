# KoyaKart — Web + Android parity plan

Four customer-facing apps share one React/Vite stack per portal. **Web behavior stays the default**; Android is an optional Capacitor shell around the same built `dist/` assets.

## Principles (avoid regressions)

1. **Same UI code** — No separate “mobile layouts”; existing responsive CSS + `env(safe-area-inset-*)` stay authoritative.
2. **Native is additive** — `Capacitor.isNativePlatform()` gates API base URL, status bar, back button, and `html.hlm-native` tweaks only.
3. **Web dev unchanged** — `npm run dev` + Vite `/api` proxy; no Capacitor required for browser work.
4. **Build-time shells for hub vs agent** — `delivery-portal` keeps combined web; hub/agent APKs set `VITE_KOYAKART_SHELL` at build time.

## App matrix

| App | Web folder | Android package | Capacitor config | Status |
|-----|------------|-----------------|------------------|--------|
| Buyer | `web/buyer-web` | `com.koyakart.buyer` | `capacitor.config.ts` | Done (reference) |
| Vendor | `web/vendor-portal` | `com.koyakart.vendor` | `capacitor.config.ts` | Done |
| Hub | `web/delivery-portal` | `com.koyakart.hub` | `capacitor.hub.config.ts` → `android-hub/` | Done |
| Agent | `web/delivery-portal` | `com.koyakart.agent` | `capacitor.agent.config.ts` → `android-agent/` | Done |

Super-admin remains **web-only**.

## Shared module

`web/shared/native/` (import alias `@hlm-native`):

- `bootstrapNativeApp({ statusBarColor })` — status bar, keyboard, splash, `hlm-native` class
- `injectNativeShellStyles()` — scroll/touch tweaks for WebView
- `resolveApiBaseUrl()` — `VITE_API_BASE_URL` → else emulator gateway `http://10.0.2.2:8080` on native → else `''` (browser proxy)
- `NativeAppBridge` — Android back: navigate back or minimize at tab roots
- `readDeliveryShell()` — `all` \| `hub` \| `agent` from `VITE_KOYAKART_SHELL`

## Per-app checklist

- [ ] `@capacitor/core`, `android`, `app`, `status-bar`, `splash-screen`, `keyboard` in `package.json`
- [ ] `capacitor.config.ts` (`webDir: dist`, `androidScheme: https`, cleartext for dev LAN)
- [ ] `index.html` — `viewport-fit=cover`, `theme-color`, `user-scalable=no` (buyer-style)
- [ ] `main.tsx` — `void bootstrapNativeApp(...)`
- [ ] `http.ts` — `resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL)`
- [ ] `AppRouter` — `<NativeAppBridge tabRoots={[...]} />`
- [ ] Scripts: `android:sync`, `android:open` (and hub/agent variants for delivery)
- [ ] Physical device QA: set `VITE_API_BASE_URL=http://<LAN-IP>:8080` before `vite build`

## Implementation order

1. **Buyer** — migrate to `@hlm-native` (reference).
2. **Vendor** — Capacitor + native wiring.
3. **Hub** — `VITE_KOYAKART_SHELL=hub`, `capacitor.hub.config.ts`, `android-hub/`.
4. **Agent** — `npm run build:agent`, `node scripts/use-capacitor-agent-config.mjs`, `npx cap sync android` (see `package.json` `android:sync:agent`).

After agent work, restore hub default: `node scripts/use-capacitor-hub-config.mjs`.

## Build verification

All portals must pass **`npm run build`** (`tsc -b && vite build`):

- `web/buyer-web`
- `web/vendor-portal`
- `web/delivery-portal` (+ `build:hub`, `build:agent`)

Shared code under `web/shared/` is typechecked via each portal’s `tsconfig` (paths for `@hlm-dates`, `react-router-dom`, `@types/react-dom`). Capacitor packages resolve through `viteCapacitorAliases()` in each `vite.config.ts`.

## QA smoke (each APK)

- Login, main tabs, deep screen + system Back
- API calls (gateway reachable on emulator `10.0.2.2:8080` or LAN IP on phone)
- No horizontal overflow; tab bar clears safe area
- Web build at same commit: `npm run dev` + browser regression on primary flows

## Play Store (later)

One Play Developer account (~$25 once), four listings. Add **release** SHA-256 to Firebase per app before production push.
