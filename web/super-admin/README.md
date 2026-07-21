# Super-admin portal

Vite + React + TypeScript · port **5176**

## Run

```powershell
cd web\super-admin
npm install
npm run dev
```

Open http://localhost:5176

**Pilot login:** `9876500900` / `password` (SUPER_ADMIN — requires user-service migration `V7__seed_super_admin.sql`)

## Features (v0.1)

| Area | Status |
|---|---|
| Login (SUPER_ADMIN only) | Done |
| Overview dashboard | Done |
| Towns — list / create / enable-disable | Done |
| Vendors — registration request, approve/reject, list | Done |
| Master catalog — list + create item | Done |
| Platform settings (legal URLs, flags) | Done |
| Fee rules / on-behalf / billing | Not in this slice |

Pages talk to gateway `:8080` via `/api` proxy. Never call `fetch` from pages — use `features/*/api`.
