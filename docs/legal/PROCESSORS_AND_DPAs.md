# Processors & DPA checklist

Use this when turning on prod keys. Store signed PDFs or portal acceptance screenshots in your internal drive (not in git).

---

## Checklist

| Step | Done | Date | Owner |
|------|------|------|-------|
| AWS account in **ap-south-1**; BAA/DPA accepted if applicable | ☐ | | |
| Razorpay live KYC; merchant T&C; webhook secret in Secrets Manager | ☐ | | |
| PhonePe / other gateway (if used) | ☐ | | |
| SMS provider (MSG91): DLT templates registered; contract filed | ☐ | | |
| FCM / Google Play: data safety form matches Privacy policy | ☐ | | |
| Legal entity name matches **supplier legal name** in Super Admin Settings | ☐ | | |
| Grievance officer name + phone published in Settings | ☐ | | |

---

## What a DPA is (for you)

A **Data Processing Agreement** is a contract where the vendor promises to process personal data only on your instructions, secure it, and help with breaches/requests. Payment and cloud providers usually embed this in their merchant/cloud terms — you still **document that you accepted them** and **list them in the Privacy policy**.

---

## Internal roles

| Role | Responsibility |
|------|----------------|
| **Data fiduciary** | Your company operating KoyaKart |
| **Grievance officer** | Name in Settings; first contact for privacy complaints |
| **Super Admin** | Publishes policy text and support phone |
| **Hub admin** | Town ops; not authorized to change platform legal text |
