# 08 — Narsaraopet Go-Live Plan

**Target:** Phase 1 soft launch → public for town **Narsaraopet**  
**Baseline (2026-07):** core pilot backend ~80% · Phase 1 APIs ~60% · full Phase 1 MVP ~35%  
**Horizon:** **12 weeks** to soft launch (invite cohort); public only after go-live gate  
**Assumes:** 2–4 people working **4 parallel tracks** (Backend, Apps, Admin, Ops/Town)

Companion backlog: root `README.md` → Phase 1 checklist + Pending. PRD rules: `01_PRD.md`.

---

## Hard rules (do not bend)

1. **Soft launch before public** (invite / closed beta with real payments).
2. **All Phase 1 surfaces mandatory:** Flutter Buyer + Vendor + Delivery; React vendor + hub + **super-admin**.
3. **Bulk price CSV** in Phase 1 (not Phase 2).
4. Buyer support = **phone** (town hub admin); legal policies published by **super-admin**.
5. Town minimums: **≥1 vendor**, **~1000** master catalog items, **~10** delivery agents (or hub-decided).

**Do not** attempt a “web-only” public launch to skip Flutter.

---

## Priority legend

| Pri | Meaning |
|---|---|
| **P0** | Blocks soft launch or real money / ops |
| **P1** | Needed before public or soon after soft launch |
| **P2** | Explicit Phase 2+ — out of scope for this plan |

---

## Critical path (P0)

| # | Item | Track | Weeks | Exit criteria |
|---|---|---|---|---|
| 1 | Real Razorpay + PhonePe (remove `dev-bypass`) | Backend | 1–2 | Staging webhook + refund verified |
| 2 | Real MSG91 SMS (OTP + order alerts) | Backend | 1–2 | Delivery OTP on real handset |
| 3 | Prod secrets: JWT rotate; remove OTP `111111` | Ops | 1 | No default secrets in staging/prod |
| 4 | Super-admin web (towns, catalog, approval, policies) | Admin | 2–5 | Approve vendor + publish legal policies |
| 5 | Vendor registration + approval + manual KYC | Backend | 3–4 | Hub request → super-admin final approve |
| 6 | Bulk price CSV upload | Backend | 3–4 | Vendor can update 100+ prices via CSV |
| 7 | Flutter Buyer (Android) | Apps | 3–8 | Browse → pay → track → invoice |
| 8 | Flutter Vendor + Delivery | Apps | 4–9 | Ready/reject + pickup → OTP delivered |
| 9 | media-service (proof photos) | Backend | 5–6 | Signed URLs for pickup/delivery proofs |
| 10 | Billing + settlements + COD reconcile | Backend | 6–8 | Weekly payout export + COD close-day |
| 11 | FCM push + device registration | Backend | 7–8 | Status pushes on all roles |
| 12 | Town content (~1000 SKUs, ≥1 vendor, ~10 agents) | Town | 8–10 | Go-live minimums met |
| 13 | Staging + runbooks + soft launch | Ops | 10–12 | Closed beta orders 1–2 weeks |

---

## Week-by-week roadmap

### Weeks 1–2 — Foundation (money + SMS + secrets)

**Goal:** Safe to take real payments and send real OTPs on staging.

| Track | Work |
|---|---|
| Ops | Staging env, secrets manager, JWT rotate, kill fixed OTP `111111` |
| Backend | Razorpay + PhonePe live; enforce webhook signatures |
| Backend | MSG91 for delivery OTP, password reset, order SMS |
| Admin | Scaffold super-admin (auth + towns list shell) |
| Apps | Flutter monorepo skeleton (Buyer / Vendor / Delivery) |

**Exit:** Staging payment + SMS E2E green; no default secrets.

---

### Weeks 3–4 — Admin + catalog scale

**Goal:** Town can onboard vendors and maintain prices at scale.

| Track | Work |
|---|---|
| Backend | Vendor registration request + super-admin approval + KYC checklist |
| Backend | Bulk price CSV import/export (**PRD mandatory**) |
| Admin | Super-admin: catalog CRUD, vendor approval, fee rules UI |
| Admin | Publish Terms / Privacy / Refund + grievance officer |
| Apps | Buyer: auth, town, catalog browse, cart |
| Ops | CI: build + dependency scan + SAST gate |

**Exit:** One vendor approved end-to-end; CSV price update works; policies URL/in-app.

---

### Weeks 5–6 — Mobile core + proofs

**Goal:** Full order journey on devices with delivery proofs.

| Track | Work |
|---|---|
| Apps | Buyer: checkout COD + ONLINE, orders, invoice, legal screens |
| Apps | Vendor: ready/reject, listings, dashboard |
| Apps | Delivery: pickup → hub → last-mile OTP |
| Backend | media-service: upload + signed URLs |
| Backend | Guest browse via gateway; buyer-web ONLINE pay |
| Admin | Hub admin PIN (disable vendor, COD close day) |

**Exit:** Device E2E COD + ONLINE order with proof photo upload.

---

### Weeks 7–8 — Money ops + push

**Goal:** Ops can settle vendors and notify users.

| Track | Work |
|---|---|
| Backend | billing-service: fee slabs, commission, e-invoice data |
| Backend | Settlements / vendor payouts + COD reconciliation |
| Backend | FCM + `POST /users/me/devices` wired in all apps |
| Apps | Delivery offline queue for status/photos (MVP) |
| Admin | reporting-service: GMV + SLA timestamp dashboards |
| Town | Start loading toward ~1000 master catalog items |

**Exit:** One settlement cycle + COD close-day dry run; push on order status.

---

### Weeks 9–10 — Scale readiness

**Goal:** Search, events, capacity, town staffing.

| Track | Work |
|---|---|
| Backend | OpenSearch catalog sync + typeahead (leave SQL as fallback) |
| Backend | Kafka + transactional outbox (replace sync HTTP fan-out) |
| Backend | Redis on hot paths (catalog / town config) |
| Apps | Play Integrity on Delivery; polish Vendor/Buyer |
| Town | ≥1 live vendor, ~10 agents trained, hub staffed |
| Ops | K8s or managed prod manifests; WAF; India region |

**Exit:** Town minimums met; staging under load smoke-tested.

---

### Weeks 11–12 — Soft launch

**Goal:** Closed beta with real money; freeze feature scope.

| Track | Work |
|---|---|
| Ops | Runbooks: payment stuck, SMS fail, town outage, Kafka lag |
| Ops | DAST on staging; pen-test before leaving pilot |
| Town | Soft-launch invite list; town-admin phone support **10–5 IST** |
| Apps | Play Console / closed testing tracks |
| Ops | 2-week soft launch; no P0 feature adds |
| Ops | Public go-live gate review (below) |

**Exit:** Soft launch complete; gate checklist reviewed for public.

---

## Parallel ownership (suggested)

| Role | Focus sequence |
|---|---|
| Backend lead | Payments → SMS → vendor/CSV → media → billing/COD → Kafka/OpenSearch |
| Apps lead | Flutter skeleton → Buyer → Vendor/Delivery → FCM → offline + Play Integrity |
| Admin / web | Super-admin → policies → hub PIN → reporting UI → buyer-web ONLINE |
| Ops / town | Staging secrets → CI → K8s → catalog/agents → soft launch + support |

---

## Public go-live gate

All must be **yes** before public traffic:

- [ ] Soft-launch week(s) with real money + real SMS; **no open P0 sev-1**
- [ ] ≥1 vendor, ~1000 master SKUs, ~10 agents active
- [ ] Flutter Buyer / Vendor / Delivery on closed testing
- [ ] Super-admin live: approvals + policies published
- [ ] Settlements + COD close-day run once successfully
- [ ] Runbooks reviewed; support phone staffed 10–5 IST
- [ ] Pen-test findings closed or explicitly accepted
- [ ] JWT/OTP defaults gone; webhook signatures enforced

---

## Remaining backlog mapped to priority

### P0 (this plan)

FCM device registration · Flutter Buyer/Vendor/Delivery · Vendor registration/approval · Bulk CSV · Hub admin PIN · Agent offline sync (MVP) · Real Razorpay/PhonePe · Real MSG91 · FCM · billing / media / reporting services · Settlements + COD · Super-admin · CI/CD + K8s + secrets · Legal in-app · Town content minimums · Soft launch ops

### P1 (soft-launch adjacent; can slip slightly)

Guest browse via gateway polish · Buyer-web ONLINE · OpenSearch · Kafka outbox · Redis usage · reporting dashboards polish · Play Integrity · Pen test · ads town-admin API

### P2 (explicitly later)

Wallet · iOS · WhatsApp · Google Maps / live GPS · Analytics warehouse · i18n · AI · ONDC · Cancellations / partial fulfill

---

## This week (start now)

1. Wire **Razorpay/PhonePe** + **MSG91** on staging (keys + webhook URLs).  
2. **Rotate JWT**; remove delivery OTP `111111`.  
3. Create **Flutter** app skeleton (3 apps, shared API client).  
4. Scaffold **super-admin** auth + towns shell.

Everything else waits on real payments and SMS.

---

## Related docs

| Doc | Role |
|---|---|
| `01_PRD.md` | Scope, surfaces, go-live rules |
| `02_SYSTEM_DESIGN.md` | Service topology |
| `03_EVENT_DRIVEN_ARCHITECTURE.md` | Kafka / outbox target |
| `06_SECURITY_REQUIREMENTS.md` | PIN, 2FA, pen test, secrets |
| Root `README.md` | Live implementation checklist + Pending |
