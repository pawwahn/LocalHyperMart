# HyperLocalMart — Batch 3 Questions (Pending)

Answer by section + number. Mark **TBD** where undecided.

**Covers:** Billing (T), Notifications (U), Audit (V), Disputes (W), Auth (X), NFR/Scale (Y), Go-live (Z), Security (SEC), Architecture (ARCH), Operations (OPS), Data/Legal/Integrations (DATA, LEGAL, INT, UX), plus open confirms from Batch 2.

---

## Open confirms from Batch 2

**CF1.** Town disabled: **browse allowed, checkout blocked** (recommended) — confirm?

**CF2.** Vendor flow: order **auto-confirmed** on payment; vendor only **Reject** or **Ready for pickup** (no Accept step) — confirm?

**CF3.** Alert if **Ready for pickup** not marked within **X hours** (not “accept”) — confirm?

**CF4.** Vendor reject after payment → **refund plan** (see PRD § Refunds) — approve or modify?

**CF5.** **M3** town-disabled browse behavior — pick A / B / C from PRD examples.

---

## T. Billing & money

**T1.** Full list of per-town config knobs in admin UI.

**T2.** Commission % on: item subtotal, after discount, incl/excl delivery fee?

**T3.** Example buyer delivery slabs (placeholder numbers OK).

**T4.** GST on platform fees — who issues invoice?

**T5.** Weekly vendor payout statement — PDF / Excel?

**T6.** COD daily reconciliation workflow (hub admin close day)?

**T7.** Payment gateway: Razorpay / PhonePe / Paytm / Cashfree / other?

**T8.** Fee rule change mid-week — new orders only?

**T9.** Wallet for buyer/vendor — ever?

**T10.** Payment chargeback — super admin or hub admin?

**T11.** When vendor rejects sub-order — commission still charged on master order?

**T12.** Refund timeline SLA (e.g. 5–7 business days online)?

---

## U. Notifications

**U1.** Final event list — add/remove any?

**U2.** WhatsApp day one or SMS-first?

**U3.** Firebase for push — OK?

**U4.** Editable templates by super admin?

**U5.** Hub admin SMS on every new order or in-app only?

**U6.** Max SMS per order (cost control)?

**U7.** Quiet hours (e.g. no SMS 10pm–8am)?

**U8.** Alert buyer when vendor rejects sub-order (whole order cancelled)?

---

## V. Town history & audit

**V1.** Full audit event list beyond vendor/agent/catalog/fees/impersonation.

**V2.** Retention: 1 / 3 / 7 years?

**V3.** Hub admin own town only; super admin all towns?

**V4.** Vendor notified when disabled — who disabled them?

**V5.** Immutable append-only audit log required?

---

## W. Disputes & exceptions

**W1.** Dispute types MVP: wrong item, missing, damaged, late — which?

**W2.** Outcomes: refund, redelivery, credit — which MVP?

**W3.** Online reversal + COD adjustment both needed?

**W4.** Super admin override order status?

**W5.** Super admin force-cancel despite no-cancel policy?

**W6.** **Buyer rejected** (COD) — auto refund record or N/A for COD?

---

## X. Auth & accounts

**X1.** Same phone as buyer + vendor in different towns — allowed?

**X2.** JWT access token TTL (15m / 1h / 24h)?

**X3.** Refresh token rotation on use?

**X4.** PIN for sensitive hub actions (disable vendor, COD close)?

**X5.** 2FA for super admin — SMS / authenticator?

**X6.** Password policy (length, complexity, expiry)?

**X7.** Account lockout after N failed logins?

**X8.** One device vs multiple sessions per user?

**X9.** Separate apps vs one app multi-role?

**X10.** Forgot password: OTP-only reset or email link too?

---

## Y. Non-functional (500 orders/day × 500 towns)

**Y1.** API p95 latency target (200ms / 500ms)?

**Y2.** RPO / RTO (e.g. RPO 1h, RTO 4h)?

**Y3.** Multi-region India or single region first?

**Y4.** Read replicas for catalog/search?

**Y5.** Search engine: PostgreSQL FTS / OpenSearch / Algolia?

**Y6.** CDN for product images?

**Y7.** Kafka events/sec estimate or TBD?

**Y8.** DB per service vs shard by town at scale?

**Y9.** Maintenance window (e.g. Sun 2–4 AM IST)?

**SCL1–SCL5.** Scale confirms: 500 orders/day/town, 500 towns, peak multiplier, rollout pace, uptime %.

---

## Z. MVP go-live (Narsaraopet)

**Z1.** Day-one mandatory surfaces checklist.

**Z2.** Soft launch (internal) before public?

**Z3.** Buyer support channel (phone / chat / WhatsApp)?

**Z4.** Terms, Privacy, Refund policies — who provides?

**Z5.** O9 bulk price update — needed in Phase 1?

---

## SEC. Security (priority)

**SEC1–SEC7.** RBAC granularity, on-behalf timeout, town-scoped APIs, IDOR testing.

**SEC8–SEC12.** JWT storage, refresh token hashing/revocation, OTP rate limits.

**SEC13–SEC19.** HTTPS, cert pinning, WAF, rate limits, request size caps.

**SEC20–SEC26.** PII encryption at rest, India residency, DPDP scope, log masking, phone masking in agent app.

**SEC27–SEC32.** PCI tokenization, webhook signatures, idempotent payments, COD limits for new buyers, KYC, duplicate GST detection.

**SEC33–SEC35.** Upload validation, private bucket + signed URLs (see CF on R7), upload limits.

**SEC36–SEC41.** Secrets manager, env separation, Kafka/Redis auth, least-privilege DB users.

**SEC42–SEC47.** Security alerts, PII access audit, pen test cadence, dependency/SAST scanning.

**SEC48–SEC51.** Root detection, screenshot block on OTP, Play Integrity, min Android version.

**S7 (revisit).** Device binding — required for agent app? (see PRD security note)

---

## ARCH. Architecture

**ARCH1–ARCH7.** Monorepo vs multi-repo, shared libs, idempotency keys, feature flags, deploy strategy.

---

## OPS. Operations

**OPS1–OPS6.** NOC, on-call, runbooks, bulk admin tools, regional admins.

---

## DATA / LEGAL / INT / UX

**DATA1–DATA3.** Analytics phase, data warehouse, SLA tracking.

**LEGAL1–LEGAL4.** FSSAI, e-invoicing, return policy display, grievance officer.

**INT1–INT4.** SMS, WhatsApp BSP, email, Maps budget.

**UX1–UX4.** Agent offline queue, low-end devices, accessibility, i18n structure.

---

## R / Storage (carry-over)

**R4.** Object storage choice after pricing review (S3 / R2 / MinIO / GCP).

**R7.** Signed URLs — adopt for all photo access? (recommended yes)
