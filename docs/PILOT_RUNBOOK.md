# Gate A — Invite COD Soft Launch Runbook

**Scope:** closed cohort, web portals, COD only. No real SMS/payments required.

Product rules & exit sign-off: [GATE_A_PRODUCT_RULES.md](./GATE_A_PRODUCT_RULES.md).

## Start stack (local)

1. Postgres + Redis (Compose) if not running.
2. Start services (or your usual `start-dev` script): gateway `:8080`, user `:8081`, town `:8082`, vendor `:8083`, catalog `:8084`, cart `:8085`, order `:8086`, payment `:8087`, delivery `:8088`, notification `:8089`.
3. Web: vendor `:5173`, delivery `:5174`, buyer `:5175`, super-admin `:5176`.
4. Health: `GET http://localhost:8086/actuator/health` (and peers) → `UP`.

## Pilot accounts (seed)

| Role | Phone | Password (seed) |
|------|-------|-----------------|
| Vendor (Ravi) | 9876500001 | `password` |
| Vendor (Siva) | 9876500002 | `password` |
| Hub admin | `9876500100` | `password` |
| Super admin | `9876500900` | `password` |

New vendors: Super-admin → **Vendors** → submit → **Approve**. Temp password = `HlM@` + last 4 digits of phone. Share once; vendor should change password in Settings.

## Delivery OTP (dev)

Fixed code: **`111111`**. Tell agents for the invite week.

## Buyer invite gate

- Empty `BUYER_INVITE_PHONES` → anyone can register (dev).
- Soft launch: set `BUYER_INVITE_PHONES=98xxxxxxxx,98yyyyyyyy` on user-service.
- Register requires Terms checkbox (`hyperlocalmart.invite.require-terms=true`).
- Buyers must **choose a town** before catalog/cart (picker cannot be dismissed until selected).

## Support

- Buyer Login shows **support phone** from Platform Settings (default pilot hub `9876500100`).
- Super-admin → **Settings**: Terms / Privacy / Refund URLs, grievance, support phone.

## Hub / agent login

- Hub admin and agent sessions resolve **hubId / townId / agentId from API** (`/delivery/hubs/me`, `/delivery/agents/me`). Do not rely on hardcoded pilot UUIDs in the UI.

## Daily COD close

1. Delivery portal (hub) → **COD**.
2. Pick agent + date → load candidates (COD delivered).
3. Enter **hub PIN** (required) + cash received → **Close day**.
4. If no custom PIN yet, pilot default is **`1234`**. Set a new 4–6 digit PIN on the COD page before soft launch with real cash.
5. Status **MATCHED** or **DISCREPANCY** — investigate discrepancies before next day.

## Stuck order checklist

1. Confirm order status in hub / vendor Home.
2. If vendor not ready: call shop; they mark Ready or Reject.
3. If pickup stuck: hub reassign / check agent login.
4. If OTP fail: use `111111` in pilot only.
5. If money looks wrong: check Reports (rejects = NOT PAYABLE) and Payouts (claims deducted).

## Exit criteria (Gate A done)

- [ ] Invite buyers placed COD orders end-to-end
- [ ] Vendor reject/cancel + claims understood
- [ ] COD close-day used at least once with cash matched (hub PIN verified)
- [ ] Hub PIN changed from default `1234` (or documented as still default for invite week only)
- [ ] New vendor onboarded via registration (not only seed)
- [ ] Support phone + legal links visible to buyers
