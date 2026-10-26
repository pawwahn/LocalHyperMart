# 09 — Legal & compliance matrix (KoyaKart)

**Purpose:** Map every “Instagram reel” compliance topic to what KoyaKart already has, what is in-repo but needs ops/lawyer action, and what is out of scope until you expand (e.g. EU users).

**Not legal advice.** Have an Indian counsel review published text before public launch.

---

## Legend

| Status | Meaning |
|--------|---------|
| **Built** | In product or shipped default copy |
| **Ops** | Process / contract / Super Admin config (no extra code required) |
| **Partial** | Started; finish before scale |
| **Later** | Phase 2+ or only if you change scope (GDPR, EU cookies, etc.) |

---

## User-facing legal documents

| Topic | Status | Where |
|-------|--------|--------|
| Terms & Conditions | **Built** | `town-service` → `legal/terms-default.txt`; Super Admin → Settings; `/legal/terms` on all web portals |
| Privacy policy | **Built** | `legal/privacy-default.txt`; version + date in app |
| Refund / cancellation / wallet / membership | **Built** | `legal/refund-default.txt`; aligns with product money rules |
| Seller / vendor rules | **Built** | Terms §9–10 (vendors, hub, agents) |
| Payments & subscriptions (buyer-facing) | **Built** | Terms §5–6, Refund §6–9; Razorpay/PhonePe (no card storage) |
| Intellectual property | **Built** | Terms §9 (vendor content), platform brand in Settings |
| Open source licenses | **Built** | `oss-licenses.bundle.json` + `/legal/oss`; refresh via `scripts/generate-oss-licenses.ps1` |
| Cookie / storage notice | **Built** | Web `CookieNotice` + Privacy §10 |
| Compliance dashboard | **Built** | Super Admin → **Compliance** (`/compliance`) |
| Vendor onboarding attestation | **Built** | Vendors → Add vendor → Terms checkbox; DB `terms_acknowledged_at` |
| Staff / buyer re-accept on legal bump | **Built** | `LegalAcceptGate` on authenticated routes + `POST /users/me/accept-legal` |

---

## Consent & rights (India-first / DPDP-aware)

| Topic | Status | Where |
|-------|--------|--------|
| Privacy + Terms consent at registration | **Built** | Buyer register checkbox; `terms_accepted_at`, `terms_version` on user |
| Legal version tracking | **Built** | Platform Settings `legalVersion`; buyer sends `acceptedLegalVersion` |
| Grievance officer | **Built** | Super Admin → Settings; shown on legal screens & login |
| Marketing consent (SMS/push promos) | **Built** | User `marketing_consent`; buyer **Privacy & data** screen; Privacy policy §11 |
| Legal basis (plain language) | **Built** | Privacy §2–3 (contract, ops, consent for marketing) |
| Data access / correction | **Partial** | Profile + addresses in app; formal DPDP requests → support/grievance (**Ops**) |
| Data deletion / erasure | **Built** | `POST /api/v1/users/me/delete-account` (buyer, password confirm); anonymize PII; orders retained for tax/audit |
| Data export | **Later** | Security doc Phase 2; until then **Ops** (support export) |
| GDPR (EU) full program | **Later** | Only if you target EU/UK users or EU tracking |
| EU cookie banner (non-essential cookies) | **Later** | India-first notice only; add strict opt-in if you add ad pixels / analytics cookies |

---

## Security, retention, processors

| Topic | Status | Where |
|-------|--------|--------|
| Data security measures | **Built** | `docs/06_SECURITY_REQUIREMENTS.md`; Privacy §5 |
| Data retention | **Built** | Privacy §4; detail matrix `docs/legal/DATA_RETENTION_AND_PROCESSORS.md` |
| Third-party disclosure | **Built** | Privacy §3 + processor list in retention doc |
| Data processing agreements | **Ops** | `docs/legal/PROCESSORS_AND_DPAs.md` — sign/file with Razorpay, MSG91, AWS, etc. |
| Data breach procedure | **Ops** | `docs/legal/INCIDENT_AND_BREACH_RUNBOOK.md` |
| India data residency | **Built** | Security + Privacy; prod in `ap-south-1` |
| PII encryption at rest | **Partial** | Required in security doc; verify infra before prod |
| Audit logs (3 years) | **Built** | Security requirements |

---

## Commerce & platform ops

| Topic | Status | Where |
|-------|--------|--------|
| Refund policy in app | **Built** | Refund doc + gateway refunds in payment-service |
| Consumer support channel | **Built** | Support phone in Platform Settings; Gate A checklist |
| Vendor KYC | **Built** | PRD + manual approval before go-live |
| GST / e-invoicing | **Partial** | Product invoices; **lawyer/CA** for registration & IRP if applicable |
| FSSAI (food) | **Ops** | Vendor responsibility + hub checklist; platform marketplace disclosure in Terms |
| Chargebacks / disputes | **Built** | Terms + claims flow; super-admin tools |

---

## Launch checklist (minimum)

1. Super Admin → **Settings**: support phone, grievance officer, review legal copy (or **Reset to shipped rules** once counsel approves defaults).
2. Confirm buyer register shows Terms / Privacy / Refund links (Gate A).
3. Run through **Privacy & data**: marketing toggle + delete account (staging).
4. File **processor checklist** when prod keys go live.
5. Keep **incident runbook** with on-call name and phone.

---

## Related docs

| Doc | Use |
|-----|-----|
| [GATE_A_PRODUCT_RULES.md](./GATE_A_PRODUCT_RULES.md) | Pilot legal sign-off |
| [06_SECURITY_REQUIREMENTS.md](./06_SECURITY_REQUIREMENTS.md) | DPDP, delete, infra |
| [legal/DATA_RETENTION_AND_PROCESSORS.md](./legal/DATA_RETENTION_AND_PROCESSORS.md) | Retention + subprocessors |
| [legal/PROCESSORS_AND_DPAs.md](./legal/PROCESSORS_AND_DPAs.md) | DPA tracker |
| [legal/INCIDENT_AND_BREACH_RUNBOOK.md](./legal/INCIDENT_AND_BREACH_RUNBOOK.md) | Breach response |
| [legal/OPEN_SOURCE_NOTICES.md](./legal/OPEN_SOURCE_NOTICES.md) | OSS compliance |
