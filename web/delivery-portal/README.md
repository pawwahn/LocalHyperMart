# Delivery portal (Vite + React + TypeScript)

Hub admin + delivery agent UI. Same stack as `web/vendor-portal`.

## Run

```powershell
$env:Path = "C:\Tools\node;" + $env:Path
cd D:\LocalHyperMart\LocalHyperMart\web\delivery-portal
npm install
npm run dev
```

Open **http://localhost:5174** (vendor portal uses 5173).

Requires gateway on `http://localhost:8080`.

## Pilot logins (password: `password`)

| Role | Phone | Lands on |
|---|---|---|
| Hub admin | `9876500100` | `/hub` |
| Delivery agent | `9876500200` | `/agent` |

## What works in v0.1

**Hub**
- Dashboard stats
- Town order list + detail (sub-orders + assignments)
- Assign pickup → Mark at hub → Assign last-mile

**Agent**
- My assignments
- Picked from vendor / from hub
- Deliver + OTP prompt

Dev OTP (local): always **`111111`** after hub assigns buyer delivery.

Optional log check:

```powershell
docker exec hlm-postgres psql -U hyperlocalmart -d hyperlocalmart_notification -c "SELECT body FROM notification_logs ORDER BY created_at DESC LIMIT 3;"
```

## Suggested demo path

1. Buyer places COD order (API or later buyer-web)
2. Vendor marks ready (`http://localhost:5173`)
3. Hub assigns pickup (`:5174` as 9876500100)
4. Agent picks from vendor (`:5174` as 9876500200)
5. Hub marks at hub + assigns last-mile
6. Agent picks from hub + delivers with OTP `111111`
