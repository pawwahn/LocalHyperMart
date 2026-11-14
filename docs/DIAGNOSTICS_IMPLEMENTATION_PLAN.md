# Diagnostics — implementation plan (living)

**Product lock:** [`DIAGNOSTICS_PRD_v1.0_LOCKED.md`](./DIAGNOSTICS_PRD_v1.0_LOCKED.md) v1.6  
**Status:** MVP in repo — enable per town + onboard lab vendors to UAT.

## Delivered (MVP)

| Layer | Scope |
|--------|--------|
| **town-service** | `diagnosticsEnabled`, `diagnosticsPlatformFeeFlat`, `diagnosticsCodEnabled`, `diagnosticsCodSurchargeAmount` in operational config + shop-settings |
| **user-service** | `patient_profiles`, `/api/v1/users/me/patients` |
| **vendor-service** | Profiles, branches, **tests + packages**, slots, staff (OTP users), audit; `/me/diagnostics`, admin, internal |
| **shared `@hlm-diagnostics`** | Reference test/package catalog + Glam-style **DiagnosticsCatalogPanel** (vendor + super-admin) |
| **order-service** | Full booking lifecycle, vendor actions, COD/UPI, **report PDF**, **settlement registry** (`SettlementCandidateService` + vendor sales report) |
| **buyer-web** | `/diagnostics`, order tracking, shop entry |
| **vendor-portal** | `/diagnostics` desk (role-aware tabs) |
| **super-admin** | `/diagnostics` town toggle + fees + lab admin |

## Next (post-MVP)

- Address **lat/lng** on buyer addresses + strict branch radius
- **media-service** binding for prescription, sample photos (≤5), report file attachments
- **Notification** templates (`DIAGNOSTICS_*`)
- **Settlement** product line label on vendor export PDFs (candidates wired; polish labels)
- **Super-admin** diagnostics order list (`/api/v1/orders/admin/diagnostics`)
- Lab-initiated **OTP booking** flow (UI)
- **QA** IDOR + RBAC automated tests

## Pilot checklist

1. Super-admin: enable diagnostics for pilot town; set platform fee + COD surcharge.
2. Register vendor with service **Diagnostics & Lab**; admin PUT profile, branches, tests, slots.
3. Create staff logins (Manager, Technician, Collection Agent).
4. Buyer: book → pay → track → download PDF after finalize.
