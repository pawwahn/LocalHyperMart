# Gate A — Product Rules (Invite COD Soft Launch)

**Audience:** ops, hub, vendors, invite buyers. **Scope:** closed cohort · web portals · **COD only**.

Operational steps: [PILOT_RUNBOOK.md](./PILOT_RUNBOOK.md).

---

## What Gate A is

| In scope | Out of scope |
|----------|--------------|
| Invite-only buyer registration | Public open signup |
| Cash on delivery (COD) checkout | UPI / cards / wallets |
| Web: buyer, vendor, delivery (hub + agent), super-admin | Native buyer/vendor apps |
| Seeded + newly approved vendors | Multi-town self-serve onboarding |
| Fixed delivery OTP in dev/pilot | Real SMS OTP provider |
| Hub PIN for COD close-day | Automated bank settlement |

---

## Buyer rules

1. **Invite list** — Set `BUYER_INVITE_PHONES` on user-service (comma-separated). Empty list = open registration (dev only).
2. **Terms** — Register requires checkbox when `hyperlocalmart.invite.require-terms=true` (default). Buyer must accept Terms, Privacy, and Refund policy links from Platform Settings.
3. **Town** — Buyer must pick an enabled town (picker stays open until chosen). Catalog/cart/checkout use that town only — no silent pilot-town fallback.
4. **Payment** — COD only at checkout. No online payment capture in Gate A.
5. **Support** — Login/register shows support phone + legal links from Super-admin → **Settings** (default support: hub `9876500100`).
6. **Claims** — Buyer may file claims within 7 days of delivery (pilot window). Hub adjudicates.

---

## Vendor rules

1. **Onboarding** — New vendor registers via super-admin **Vendors** → approve. Temp password: `HlM@` + last 4 digits of phone; vendor should change in Settings.
2. **Orders** — Vendor marks sub-order **Ready** or **Reject** (with reason). Rejected lines are **not payable** in reports/payouts.
3. **Shop pause** — Vendor can pause/resume accepting orders from portal header.
4. **Hub contact** — Pickup help phone/name comes from delivery hub contacts for the vendor’s town (API), with a safe fallback if delivery-service is down.

---

## Hub & agent rules

1. **Login** — Hub admin and agent resolve `hubId` / `townId` / `agentId` from API (`/delivery/hubs/me`, `/delivery/agents/me`). No hardcoded pilot UUIDs in session.
2. **Workflow** — Hub assigns pickup → agent collects from vendor → hub receives at hub → hub assigns last mile → agent delivers with OTP.
3. **Delivery OTP** — Pilot fixed code **`111111`** (tell agents for invite week). Not real SMS.
4. **COD close-day** — Hub → **COD**: pick agent + date, enter **hub PIN**, enter cash received, **Close day**. Default PIN **`1234`** until hub sets a new 4–6 digit PIN on the COD page. Investigate **DISCREPANCY** before next close.
5. **Reject / money** — Vendor rejects → not in vendor payable totals. Claims reduce payout when approved.

---

## Super-admin rules

1. **Platform Settings** — Terms URL, Privacy URL, Refund URL, grievance officer, support phone (required for buyer consent UX).
2. **Vendor approval** — Only approved vendors appear in catalog for their town.
3. **No real payments** — Do not enable payment-gateway flows for Gate A cohort.

---

## Security & data (pilot)

- Seed passwords are `password` (dev) or temp vendor format above — rotate before wider launch.
- Do not commit `.env` with production secrets.
- Reset transaction data with `scripts/reset-pilot-transactions.sql` when re-running E2E demos.

---

## Gate A exit sign-off checklist

Sign when **all** are true for the invite cohort:

### Orders & money
- [ ] At least one invite buyer completed a **COD order** end-to-end (place → vendor ready → hub assign → deliver → OTP).
- [ ] Vendor **reject** exercised; hub/vendor understand reject = not payable.
- [ ] At least one **claim** filed or walkthrough completed (optional if no disputes in cohort).
- [ ] **COD close-day** run at least once; cash **MATCHED** (or discrepancy documented and resolved).
- [ ] Hub PIN **changed from default `1234`** (or explicitly documented as still default for invite week only).

### People & access
- [ ] `BUYER_INVITE_PHONES` set for soft launch (not empty in prod-like env).
- [ ] At least one **new vendor** onboarded via registration + approval (not only seed shops).
- [ ] Hub admin + agents can log in; sessions show correct hub/town from API.

### Legal & support
- [ ] Terms, Privacy, Refund URLs set in Platform Settings and visible on buyer register.
- [ ] Support phone visible on buyer login/register.
- [ ] Grievance officer name set (if required by your compliance review).
- [ ] Fresh buyer must choose town before browsing/checkout (no default town).

### Security (Gate A)
- [ ] Hub admin cannot COD-close another hub’s town (scope check verified once).
- [ ] `/vendors/me` returns only the logged-in vendor.

### Ops readiness
- [ ] Stuck-order runbook ([PILOT_RUNBOOK.md](./PILOT_RUNBOOK.md)) reviewed with hub lead.
- [ ] Agents briefed on OTP `111111` and hub support number.
- [ ] Known gaps logged for Gate B (real SMS, online pay, multi-town scale).

**Signed off by:** _________________ **Date:** _________
