# Security incident & personal-data breach runbook (internal)

**Goal:** Contain harm, preserve evidence, notify where law requires, communicate honestly.

---

## 1. Detect & classify (0–1 hour)

- Sources: CloudWatch/Prometheus alerts, hub report, user complaint, dependency scan, pen-test finding.
- Classify: **Security** (no PII leak) vs **Personal data breach** (PII/access likely disclosed).

---

## 2. Contain (immediate)

| Action | When |
|--------|------|
| Rotate JWT signing key / gateway secrets | Credential leak suspected |
| Disable compromised super-admin / hub account | Account takeover |
| Block IP / WAF rule | Active scraping or attack |
| Pause affected service | Data exfiltration in progress |

Document **who** did **what** and **UTC time** in a single incident doc.

---

## 3. Assess personal-data breach

Answer:

1. What data (phones, addresses, orders, KYC, photos)?
2. How many users / vendors?
3. Cause (misconfig, stolen laptop, vendor leak)?
4. Is data encrypted at rest / in transit?
5. Ongoing or closed?

Cross-check [DATA_RETENTION_AND_PROCESSORS.md](./DATA_RETENTION_AND_PROCESSORS.md) for subprocessors to notify.

---

## 4. Notify

| Audience | When |
|----------|------|
| **Leadership / legal counsel** | Immediately for any personal-data breach |
| **Regulators / Data Protection Board** | As required under **DPDP Act** and advice of counsel — do not delay legal review |
| **Affected users** | When breach likely affects them; use support phone/SMS template approved by counsel |
| **Processors** | If their systems involved (AWS, Razorpay, etc.) |

Template (users — customize with lawyer):

> We detected [brief nature] on [date]. Data that may be involved: [types]. We have [contained/changed passwords/…]. Contact [grievance officer / support phone]. We are investigating and will update you.

---

## 5. Recover & post-mortem (within 5 business days)

- Root cause and fix merged.
- Update `06_SECURITY_REQUIREMENTS.md` or infra if control failed.
- If Privacy policy promises changed, bump legal version in Super Admin Settings.

---

## Contacts (fill in)

| Role | Name | Phone |
|------|------|-------|
| Incident lead | | |
| Grievance officer | (same as Settings) | |
| Legal counsel | | |
| AWS / hosting | | |
