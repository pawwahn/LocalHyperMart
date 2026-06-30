# HyperLocalMart — Security Requirements

## Version

1.1 (complete — aligned with PRD v2.3)

---

# Principles

* **India data residency** — all production data in India region (ap-south-1)
* **Least privilege** — town-scoped access for hub admin; agents see assigned orders only
* **No card storage** — UPI / GPay / PhonePe / QR only via Razorpay & PhonePe
* **Audit everything sensitive** — immutable logs, 3 years retention
* **No device binding for agents** — login on any phone; disable account + audit if misuse

---

# Authentication & Sessions

| Requirement | Decision |
|---|---|
| Access token TTL | **1 hour** |
| Refresh tokens | **Hashed server-side**, rotation on use, revoke on logout |
| Mobile token storage | Android Keystore / iOS Keychain |
| Password policy | Min **8** chars, complexity, **no expiry** |
| Failed login lockout | **5 attempts** — globally configurable by super admin |
| Forgot password | **OTP only** |
| Super admin 2FA | **SMS + authenticator** |
| Same phone, multiple roles | **Allowed** |
| Multiple device sessions | **Allowed** (agents may change phones) |
| Hub admin PIN | **Required** for disable vendor, COD close day |

---

# OTP

| Setting | Value |
|---|---|
| Expiry | **5 minutes** |
| Rate limit | **5 requests / phone / hour** |
| Delivery OTP | Brute-force lockout |
| Hub admin OTP override | Allowed — **audit logged** |

---

# Authorization (RBAC)

* **Roles only** in MVP
* **Town scope** on all hub-admin APIs
* Vendor / agent / buyer data isolation enforced
* **IDOR testing** in QA checklist

---

# Super Admin On-Behalf

* Banner: *"Acting as [Town] Hub Admin"*
* Timeout: **30 minutes**
* All actions logged with real admin identity

---

# Network & API

* HTTPS only, TLS 1.2+
* API Gateway rate limiting (per user + IP)
* **WAF** in production
* Strict **CORS** for admin web origins
* Request body cap **1 MB** (excluding uploads)
* Certificate pinning — Phase 2 optional
* Webhook signature verification — Razorpay & PhonePe

---

# Payments

* No card data on platform
* **Idempotency-Key** on order/payment POST
* Buyer block by town admin / super admin (no default COD cap)
* Chargebacks — super admin only

---

# Data Protection

* PII encryption at rest (phone, address, GST, bank)
* Field-level encryption for bank/GST recommended
* Account delete → **anonymize** orders (retain financial audit)
* Logs never contain passwords, OTP, JWT
* Agent app masks buyer phone until delivery

---

# DPDP / Legal

* Privacy policy + consent at registration
* Grievance officer contact in app (super admin configurable)
* Phase 2: self-service data export/delete

---

# Uploads & Media

* AWS S3 ap-south-1, private buckets
* **Signed URLs** (15–60 min) for all photo access
* Malware + content-type validation; strip EXIF
* Max 5 MB/photo; upload count configurable per town
* Hub admin cannot delete photos

---

# Onboarding & Fraud

* Manual KYC before vendor/hub go-live
* Duplicate GST / shop detection
* Buyer block list

---

# Infrastructure

* Secrets Manager — not in git
* Dev / staging / prod isolated
* Kafka SASL/SSL, Redis auth
* Separate DB user per microservice
* Quarterly credential rotation

---

# Monitoring & App Hardening

| Control | Decision |
|---|---|
| Security alerts (login spikes, DLQ flood, admin anomalies) | **Yes** — CloudWatch/Prometheus alerts |
| Audit PII/photo/payout **views** | **Yes** — hub admin and super admin |
| Incident response documentation | **Yes** before scale-up |
| Penetration test | **Before leaving pilot** (Narsaraopet); then **annual** |
| Dependency scanning (Dependabot/Snyk) | **Yes** in CI |
| SAST (SonarQube) | **Yes** in CI |
| DAST | **Staging** before major releases |
| Root/jailbreak detection | **Warn only** (do not block — small-town devices) |
| Screenshot block on OTP | **No** for MVP (support/debug friction; rely on OTP + audit) |
| Play Integrity API | **Phase 1** on Delivery app |
| Min Android | **8+** (API 26) |
| Device binding | **No** — login-based; disable agent if abuse |

---

# CI/CD Security Gates

1. Dependency scan must pass
2. SAST quality gate
3. No secrets in code (git-secrets scan)
4. DAST on staging before production promote
