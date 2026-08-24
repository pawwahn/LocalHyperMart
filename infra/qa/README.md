# QA plan (only) — HyperLocalMart

**Goal:** Gate A testing. COD, web portals, OTP `111111`.  
**Not in this plan:** prod VM, live UPI, MSG91, S3, ECS, OCI, Kubernetes.

Work **Phase 1** to completion. Open **Phase 2** only if testers cannot use your PC.

---

## Phase 1 — local QA (your Windows PC)

**Why first:** every bug here will also appear on a cloud VM. Do not pay for Lightsail until this is green.

### Start

From `D:\LocalHyperMart\LocalHyperMart`:

1. Docker Desktop running.
2. `docker compose up -d`
3. `.\scripts\start-dev.ps1 -SkipBuild -ServicesOnly` (or full build if code changed)
4. `.\scripts\health-check.ps1` — services UP, towns listed.

Web (Node on PATH or `C:\Tools\node`):

| App | Command | URL |
|---|---|---|
| Vendor | `web\vendor-portal` → `npm run dev` | http://localhost:5173 |
| Hub / agent | `web\delivery-portal` | http://localhost:5174 |
| Buyer | `web\buyer-web` | http://localhost:5175 |
| Super-admin | `web\super-admin` | http://localhost:5176 |

Gateway: http://localhost:8080  

Pilot logins (password `password`): vendor `9876500001`, hub `9876500100`, agent `9876500200`, super-admin `9876500900`.  
Buyer: register a new phone (e.g. `Buyer@123`). Delivery OTP: **`111111`**.

Full click/API script: `Documents/DailySteps.md`.

### Test cases (sign these off)

Do each once. Product rules: `docs/GATE_A_PRODUCT_RULES.md`.

1. Buyer: town → catalog → cart → address → **COD** checkout.
2. Vendor: mark sub-order **Ready**.
3. Hub: assign pickup → agent pick from vendor → hub **at hub**.
4. Hub: assign last mile → agent deliver with **`111111`**.
5. Buyer: order **DELIVERED**, invoice PDF.
6. Separate order: vendor **Reject** (not payable).
7. Hub: **COD close-day** with PIN (`1234` until you change it).
8. Super-admin: approve **one new vendor** (not only seed shops).
9. Super-admin: Settings — support phone + Terms/Privacy/Refund links visible on buyer register.

### Phase 1 exit

All nine passed on **this PC**. Write down anything still broken. **Stop here** if testers can sit with you. Prod is out of scope.

---

## Phase 2 — shared QA URL (AWS Lightsail only)

**Why:** remote testers need a browser URL. Same Gate A rules as Phase 1. Still not prod.

### AWS (you click; this repo cannot create the VM)

1. AWS account + **MFA**. Region **Mumbai (ap-south-1)**.
2. Billing → **$5 budget alert**. Check **Credits** / Lightsail **free trial** (trial is **$5–$12 VMs only**, not 8 GB).
3. Lightsail **Linux, Ubuntu, 8 GB**. 4 GB will not hold 12 Java services.
4. Firewall: **HTTP 80** only. No 8080–8092 public.
5. Attach a **static IP**.

About **$44/month** + GST unless credits cover it.

### On the VM

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu
# SSH again after usermod

# Put this repo on the VM (git clone or copy the LocalHyperMart folder)
cd LocalHyperMart   # nested folder if needed: cd LocalHyperMart/LocalHyperMart
cp .env.qa.example .env.qa
nano .env.qa        # JWT_SECRET 32+ chars, strong POSTGRES_PASSWORD
docker compose -f docker-compose.qa.yml --env-file .env.qa up -d --build
```

First build **15–30 minutes**. Then:

```bash
docker compose -f docker-compose.qa.yml ps
curl -s "http://localhost/api/v1/towns?status=ENABLED"
```

### URLs to send testers

Replace `IP` with the static IP.

| App | URL |
|---|---|
| Buyer | http://IP/ |
| Vendor | http://IP/vendor/ |
| Hub / agent | http://IP/hub/ |
| Super-admin | http://IP/admin/ |

Same seed logins. OTP **`111111`**. Repeat the nine test cases on this URL.

### If something is down

```bash
docker compose -f docker-compose.qa.yml logs --tail=80 catalog-service
docker stats
```

---

## QA rules (both phases)

| On | Off |
|---|---|
| COD | Live Razorpay |
| OTP `111111` | Real MSG91 / DLT |
| Seed passwords OK for testers | Prod JWT, empty OTP bypass |
| One town (Narsaraopet seed) is enough | 10 towns, ECS, second cloud |
| Images on disk / local is OK | S3 required |

Invite list (`BUYER_INVITE_PHONES`) optional on local; set it on Lightsail if you do not want strangers registering on a public IP.

---

## After QA (not now)

When Phase 1 (and Phase 2 if you used it) is signed off, **then** plan prod: second 8 GB VM, new secrets, no `111111`, no `dev-bypass`, S3, HTTPS, Razorpay, MSG91. Do not reuse the QA VM or `.env.qa` for live UPI.
