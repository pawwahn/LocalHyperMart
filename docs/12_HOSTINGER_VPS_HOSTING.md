# 12 — Hostinger VPS hosting (early prod / shared QA)

**Use this for:** a single Ubuntu VPS on Hostinger running the same Docker Compose stack as `docker-compose.qa.yml`.  
**Do not use:** Hostinger shared/cPanel hosting — this app needs Docker, ~8 GB RAM, and long-running Java/Kafka/Postgres.

**Companion:** `infra/qa/README.md` (Gate A QA flow), `docs/11_AWS_PILOT_HOSTING.md` (migrate to AWS later), `docs/QA_SECURITY_CHECKLIST.md`.

---

## What you are deploying

| Piece | On the VPS |
|-------|------------|
| Postgres, Redis, Kafka, Zookeeper | Docker (compose) |
| 12 Java microservices + api-gateway | Docker (compose) |
| buyer / vendor / hub / super-admin web | Nginx in `web` container on port **80** |
| Public entry | **HTTPS** (host nginx + Let’s Encrypt) → `http://127.0.0.1:8080` (Docker web) |

Path routing (same as QA):

| App | URL path |
|-----|----------|
| Buyer | `/` |
| Vendor | `/vendor/` |
| Hub / delivery | `/hub/` |
| Super-admin | `/admin/` |
| API | `/api/` |

---

## 1. Hostinger purchase & sizing

1. **Product:** [Hostinger VPS](https://www.hostinger.com/vps-hosting) (KVM), **not** Web Hosting.
2. **OS:** Ubuntu 22.04 or 24.04.
3. **RAM:** **8 GB minimum** (12 Java services + Kafka + Postgres on one box). **16 GB** is safer for a small prod pilot.
4. **Region:** Pick the closest datacenter to Andhra Pradesh (often Singapore or India if offered).
5. **Firewall (hPanel → VPS → Firewall):** allow **22** (SSH, your IP only if possible), **80**, **443**. Do **not** expose 5432, 6379, 8080–8092, or 9092 to the internet.

Attach the VPS **static IP** (included) — you will point DNS here.

---

## 2. Domain & DNS (Hostinger or elsewhere)

In Hostinger **DNS zone** (or your registrar):

| Type | Name | Value |
|------|------|--------|
| A | `@` | VPS IPv4 |
| A | `www` | VPS IPv4 (optional) |
| A | `api` | VPS IPv4 (optional; same box, same nginx — only if you want a separate hostname for webhooks/docs) |

For a **single-host** pilot, one hostname (e.g. `shop.yourdomain.in`) is enough: Razorpay webhooks use `https://shop.yourdomain.in/api/v1/payments/webhooks/...`.

---

## 3. One-time server bootstrap

SSH as root (or sudo user):

```bash
ssh root@YOUR_VPS_IP
```

From your PC, copy the bootstrap script to the server, or clone the repo and run:

```bash
cd /opt
git clone https://YOUR_GIT_REMOTE/LocalHyperMart.git
cd LocalHyperMart/LocalHyperMart   # adjust if repo root is one level up
chmod +x scripts/hostinger-vps-bootstrap.sh
sudo ./scripts/hostinger-vps-bootstrap.sh
```

The script installs Docker, enables swap (helps on 8 GB), and installs **host nginx** as an HTTPS front door.

Log out and back in so your user is in the `docker` group.

---

## 4. Environment file (never commit)

```bash
cd /opt/LocalHyperMart/LocalHyperMart
cp .env.qa.example .env.qa
nano .env.qa
```

Generate strong values (example on Linux):

```bash
openssl rand -base64 32   # JWT_SECRET
openssl rand -base64 24   # HLM_INTERNAL_SERVICE_SECRET
openssl rand -base64 24   # POSTGRES_PASSWORD / REDIS_PASSWORD
```

**Required keys** (see `docs/QA_SECURITY_CHECKLIST.md`):

| Variable | QA / invite testing | Production |
|----------|---------------------|------------|
| `JWT_SECRET` | ≥32 chars, unique | Same |
| `HLM_INTERNAL_SERVICE_SECRET` | unique | Same |
| `POSTGRES_PASSWORD`, `REDIS_PASSWORD` | strong | strong |
| `DELIVERY_OTP_FIXED_CODE` | `111111` OK for Gate A | **unset** |
| `PASSWORD_RESET_OTP_FIXED_CODE` | optional QA | **unset** |
| `PAYMENT_DEV_WEBHOOK_BYPASS` | unset | **unset** |
| `BUYER_INVITE_PHONES` | optional lock | recommended on public IP |
| `HLM_CORS_ALLOWED_ORIGIN_PATTERN` | your site origin | not `*` |
| `PAYMENT_RETURN_URL` | `https://yourdomain.in/shop` | live HTTPS URL |
| `RAZORPAY_*` / Cashfree | test keys | live keys + webhooks |

---

## 5. Build & start the stack

First run builds all JARs and web apps inside Docker (**15–40 minutes** on an 8 GB VPS):

```bash
docker compose -f docker-compose.qa.yml -f docker-compose.hostinger.yml --env-file .env.qa up -d --build
docker compose -f docker-compose.qa.yml -f docker-compose.hostinger.yml ps
curl -s "http://127.0.0.1:8080/api/v1/towns?status=ENABLED"
```

Docker `web` listens on **127.0.0.1:8080** only (`docker-compose.hostinger.yml`). Host nginx uses **80/443** on the public interface.

---

## 6. HTTPS (Let’s Encrypt on host nginx)

Replace `shop.yourdomain.in` in the template, then:

```bash
sudo cp infra/nginx/hostinger-ssl.conf.example /etc/nginx/sites-available/hlm
sudo sed -i 's/shop.example.com/shop.yourdomain.in/g' /etc/nginx/sites-available/hlm
sudo ln -sf /etc/nginx/sites-available/hlm /etc/nginx/sites-enabled/hlm
sudo nginx -t && sudo systemctl reload nginx

sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d shop.yourdomain.in
```

Certbot will adjust the server block for TLS. Renewals: `certbot renew` (timer installed by package).

**Payment webhooks (prod):**

- Razorpay: `https://shop.yourdomain.in/api/v1/payments/webhooks/razorpay`
- Cashfree: `https://shop.yourdomain.in/api/v1/payments/webhooks/cashfree`

---

## 7. Smoke tests

1. Browser: `https://shop.yourdomain.in/` — buyer home loads.
2. `https://shop.yourdomain.in/vendor/` — vendor login.
3. Register/login buyer; COD order through vendor → hub → delivery (Gate A script: `Documents/DailySteps.md`).
4. `docker compose -f docker-compose.qa.yml logs --tail=100 api-gateway` — no repeated 5xx.

---

## 8. Backups & ops (VPS prod)

- **Postgres:** nightly `pg_dump` or volume snapshot to **off-server** storage (Hostinger backup add-on or S3).
- **`.env.qa`:** store encrypted copy outside the VM.
- **Updates:** `git pull` → `docker compose ... up -d --build` in a maintenance window.
- **When to leave Hostinger:** see `docs/11_AWS_PILOT_HOSTING.md` § *Hosting evolution policy* (~50 towns or resource pain → AWS).

---

## 9. Troubleshooting

| Symptom | Check |
|---------|--------|
| Build OOM | Upgrade to 16 GB RAM or add swap (bootstrap adds 4G) |
| 502 from host nginx | `docker compose ps`; `curl http://127.0.0.1:8080/api/v1/towns` |
| Webhooks fail | HTTPS valid, URL exact, `RAZORPAY_WEBHOOK_SECRET`, no bypass env |
| Slow checkout | `docker stats`; Kafka/Postgres on same disk — use SSD plan |

```bash
docker compose -f docker-compose.qa.yml logs --tail=80 payment-service
docker stats --no-stream
```

---

## Quick reference

```bash
# Start
docker compose -f docker-compose.qa.yml -f docker-compose.hostinger.yml --env-file .env.qa up -d

# Rebuild after code change
docker compose -f docker-compose.qa.yml -f docker-compose.hostinger.yml --env-file .env.qa up -d --build

# Stop
docker compose -f docker-compose.qa.yml -f docker-compose.hostinger.yml down
```
