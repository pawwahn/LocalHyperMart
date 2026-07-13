# Vendor portal (Vite + React + TypeScript)

First HyperLocalMart web app. Same stack will be reused for hub, buyer, and super-admin portals.

## Prerequisites

- Node.js 20+ (LTS)
- Backend gateway running on `http://localhost:8080` (see `Documents/DailySteps.md`)

## Run locally

```powershell
cd D:\LocalHyperMart\LocalHyperMart\web\vendor-portal
npm install
npm run dev
```

Open **http://localhost:5173**

Dev proxy forwards `/api` → `http://localhost:8080` (no CORS setup needed for local).

## Pilot login

| Phone | Password | Shop |
|---|---|---|
| `9876500001` | `password` | Ravi Kirana |
| `9876500002` | `password` | Siva General Store |

## What works in v0.1

- Login (VENDOR role required)
- Dashboard stats (today / week / earnings)
- Sub-order list with status filter
- Mark ready / Reject
- Listings: list, create, edit price, activate/deactivate
- Nav: Orders ↔ Listings

## Architecture (loose coupling)

```text
src/
  features/auth/       api · hooks · pages
  features/orders/     api · hooks · components · pages
  features/listings/   api · hooks · components · pages
  shared/              theme · http client · auth · layout · routing
  app/                 router composition
```

- Pages never call `fetch` — repositories in `features/*/api`
- API DTOs are mapped to view models in the data layer
- Styles use theme CSS variables from `shared/theme`

## High-traffic note

This is a static SPA. Under heavy load, host the built assets on a CDN and scale the Spring services / Postgres — not the UI process.
