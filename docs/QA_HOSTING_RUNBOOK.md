# QA hosting runbook — KoyaKart

**Status:** QA in progress (no prod until explicit **QA signed off**).  
**URL:** `https://qa.koyakart.com`  
**Server:** Hostinger **KVM 4** (16 GB), **India**, **Ubuntu 22.04/24.04**.

---

## Tester URLs (web only — 8 QA, staggered)

| Role | URL |
|------|-----|
| Buyer | https://qa.koyakart.com/ |
| Vendor | https://qa.koyakart.com/vendor/ |
| Hub | https://qa.koyakart.com/hub/ |
| Super-admin | https://qa.koyakart.com/admin/ |

Mobile apps: **after QA sign-off** (optional 1–2 APK smoke later).

---

## Phase checklist

### A — Before VPS exists

- [ ] Generate secrets (see `.env.qa.example` header); store master copy in **team password manager**
- [ ] Copy `.env.qa.example` → `.env.qa` locally; fill secrets and QA URLs
- [ ] Cloudflare: add **A** record `qa` → VPS IP (proxied)

### B — VPS day

- [ ] Firewall: **22** (your IP), **80**, **443** only
- [ ] Install Docker; clone repo to e.g. `/opt/LocalHyperMart/LocalHyperMart`
- [ ] Upload `.env.qa` to server; `chmod 600 .env.qa`
- [ ] First deploy: `./scripts/qa-deploy.sh --build` (30–40 min)
- [ ] Host nginx + TLS: `docs/12_HOSTINGER_VPS_HOSTING.md` — cert for **`qa.koyakart.com`**
- [ ] Smoke: browser loads buyer home; API towns list returns JSON

### C — Hand off to 8 testers

- [ ] Share URLs + QA OTP note (`111111` for delivery/password reset if using fixed codes)
- [ ] Assign roles (e.g. 3 buyer, 2 vendor, 2 hub, 1 admin)
- [ ] First test: **COD** order end-to-end
- [ ] Enable Razorpay **test** keys + webhook when ready for online pay

### D — Backups (no Hostinger paid backup required)

- [ ] `./scripts/qa-backup.sh` manually once; then cron nightly
- [ ] Copy latest `backups/qa/*.sql.gz` **off VPS**
- [ ] One restore drill before testers depend on data

### E — QA sign-off gate

- [ ] `docs/QA_SECURITY_CHECKLIST.md` (QA sections)
- [ ] Two testers in different cities: COD + sandbox online pay
- [ ] Product owner says **QA signed off** → only then plan prod (`www.koyakart.com`, KVM 8)

---

## Secrets — where they live

| Location | Allowed |
|----------|---------|
| `.env.qa` on QA VPS | Yes (`chmod 600`) |
| Password manager vault | Yes (backup copy) |
| Git / Slack / email | **No** |

---

## Deploy updates

```bash
cd /opt/LocalHyperMart/LocalHyperMart
git pull
./scripts/qa-backup.sh    # before risky changes
./scripts/qa-deploy.sh --build
```

After **diagnostics** (or any change touching `libs/common-core`, Flyway **V36+** on order-service, or vendor **V26+**), run `mvn install -pl libs/common-core -DskipTests` (or a full `./scripts/qa-deploy.sh --build`) so shared classes like `GeoDistance` and `IndianMobilePhones` are on every service classpath, then confirm **order-service** and **vendor-service** containers restarted. Stale JVMs cause **Internal server error** on glam/laundry listings or diagnostics **Add staff** (`NoClassDefFoundError` in logs).

---

## Payment webhooks (sandbox)

| Gateway | URL |
|---------|-----|
| Razorpay | `https://qa.koyakart.com/api/v1/payments/webhooks/razorpay` |
| Cashfree | `https://qa.koyakart.com/api/v1/payments/webhooks/cashfree` |

---

## Related docs

- `docs/12_HOSTINGER_VPS_HOSTING.md` — nginx / certbot
- `docs/QA_SECURITY_CHECKLIST.md` — security before widening access
- `docker-compose.qa.yml` + `docker-compose.hostinger.yml`
