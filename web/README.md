# React web portals

**Stack for all portals:** Vite + React + TypeScript (single stack — vendor, hub, buyer, super-admin).

| App | Path | Status |
|---|---|---|
| Vendor portal | `web/vendor-portal` | Login, orders, listings — port **5173** |
| Delivery / hub portal | `web/delivery-portal` | Hub + agent — port **5174** |
| Buyer web | `web/buyer-web` | Shop, cart, COD checkout — port **5175** |
| Super-admin | `web/super-admin` | Not started (same stack) |

## Architecture (loosely coupled, wireframe-resilient)

```text
src/features/<domain>/
  api/        # typed client (gateway :8080), mappers to view models
  hooks/      # state, side effects
  components/ # presentational pieces
  pages/      # route-level layout composition
src/shared/   # theme tokens, UI kit, router, auth context
  theme/      # colors, spacing, radii, shadows (reskin here)
  ui/         # Button, Card, Banner, TextField, EmptyState…
```

- Pages **never** call `fetch` directly — use feature `api/` repositories.
- New wireframes should change **pages/** + **components/** + theme, not API clients.
- Visual language: light Quick-commerce / Pachari-inspired retail UI (green buyer+vendor, blue delivery).
- Full rules: `docs/02_SYSTEM_DESIGN.md` §2.2 and `.cursor/rules/loose-coupling.mdc`.

## Local run

```powershell
# Vendor  → http://localhost:5173
cd web\vendor-portal
npm run dev

# Hub / agent → http://localhost:5174
cd web\delivery-portal
npm run dev

# Buyer → http://localhost:5175
cd web\buyer-web
npm run dev
```
