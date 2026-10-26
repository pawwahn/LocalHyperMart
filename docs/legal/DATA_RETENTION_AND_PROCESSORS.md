# Data retention & subprocessors (internal)

**Owner:** Super Admin / platform ops. **Align with:** in-app Privacy policy (Super Admin → Settings).

---

## Retention matrix (default policy)

| Data class | Typical retention | After account delete | Notes |
|------------|-------------------|----------------------|--------|
| Buyer profile (name, phone, email) | Life of account | **Anonymized** | Phone → internal deleted marker; login disabled |
| Delivery addresses | Life of account | **Deleted** | Removed on buyer self-delete |
| Orders, sub-orders, invoices | **7+ years** (tax/dispute) | **Kept** | Linked to anonymized user id; delivery snapshot retained |
| Wallet / membership ledger | **7+ years** | **Kept** | Financial audit |
| COD close-day & agent cash | **7+ years** | **Kept** | Hub ops |
| Payment gateway refs (Razorpay/PhonePe) | Per gateway + 7 years internal | **Kept** | No full card numbers stored |
| Refresh tokens / sessions | Until expiry or logout | **Revoked** on delete |
| OTP / PIN artifacts | Minutes–hours | N/A | Not logged in app logs (security req) |
| Sensitive audit logs | **3 years** minimum | **Kept** | `06_SECURITY_REQUIREMENTS.md` |
| Delivery proof photos | Town/product rules | **Kept** unless town policy deletes | Signed URLs only |
| Vendor KYC (GST, bank) | Life of vendor + legal hold | N/A for buyer delete | Vendor offboarding separate process |
| Marketing consent record | Life of account + proof | **Kept** timestamp of last choice | DPDP evidence |

Adjust periods after CA/lawyer review for your entity type (private ltd, LLP, etc.).

---

## Subprocessors (fill before prod)

| Processor | Purpose | Data shared | Region | DPA / terms |
|-----------|---------|-------------|--------|-------------|
| **AWS** (ap-south-1) | DB, S3, secrets, compute | All platform data | India | AWS Customer Agreement + DPA |
| **Razorpay** | Online payments, refunds | Name, phone, order amount, payment ids | India | Razorpay merchant agreement |
| **PhonePe / Cashfree** (if enabled) | Payments | Same class as Razorpay | India | Merchant agreement |
| **MSG91** (or SMS vendor) | OTP, transactional SMS | Phone, message metadata | India | Vendor DPA / contract |
| **FCM (Google)** | Push notifications | Device token, message payload | Global infra | Google terms + data processing |
| **OpenSearch** (self-hosted or managed) | Search/catalog | Catalog, non-sensitive indexing | India target | Internal / cloud vendor |
| **Kafka** (self-hosted) | Events | Order/payment events | India target | Internal |

Do **not** add analytics (Meta Pixel, GA4) until Privacy policy and cookie consent strategy are updated.

---

## Buyer delete vs vendor offboarding

- **Buyer self-delete:** API anonymizes buyer PII; does not remove order history required by law.
- **Vendor / agent / hub:** No self-delete in MVP; Super Admin disables account and retains commercial records.

---

## Review cadence

- **Quarterly:** Processor list matches live integrations.
- **On new integration:** Update Privacy § processors + this table before enabling in prod.
