# 11 — AWS pilot hosting (4 towns · Andhra Pradesh · Single-AZ)

**Region:** `ap-south-1` (Mumbai) — aligns with `docs/06_SECURITY_REQUIREMENTS.md` (India residency).  
**Scope:** Initial launch in **4 towns** (invite/soft launch → controlled widen).  
**Strategy:** **Single-AZ** pilot until traffic/revenue justify Multi-AZ. Two valid paths:

| Path | Best for |
|------|----------|
| **A — EC2 + RDS** (below) | Easier later move to VPC/WAF/Multi-AZ RDS |
| **B — Lightsail prod** ([§ Lightsail prod](#lightsail-for-production-yes-for-this-pilot)) | Simplest bill + same Compose as QA; good for Dec soft launch |

**Companion:** `infra/qa/README.md` (QA VM), `docs/08_GO_LIVE_PLAN.md`, `docs/09_LEGAL_COMPLIANCE_MATRIX.md`.

---

## Lightsail for production? **Yes, for this pilot**

Lightsail is **allowed and reasonable** for **4-town soft launch** if you accept the same **Single-AZ / single-instance** risks as a small EC2 box. It matches what you already documented for QA (`infra/qa/README.md`).

### Recommended Lightsail prod layout

```text
Route 53  →  domain A records / CNAME
   │
   ▼
Lightsail Load Balancer  +  attached certificate (HTTPS)
   │
   ▼
Lightsail instance  (16 GB or 32 GB RAM, Mumbai)
   │  docker compose -f docker-compose.qa.yml pattern (prod .env)
   │  nginx routes: /  /vendor/  /hub/  /admin/  /api → gateway
   │
   ├──► Lightsail managed PostgreSQL  (separate bundle, NOT on the VM disk)
   └──► S3 bucket (standard AWS S3 in ap-south-1 — create in main AWS console, IAM user on VM)
```

| Piece | Spec | Why |
|-------|------|-----|
| **Prod app instance** | **16 GB RAM / 4 vCPU** minimum; **32 GB** if Kafka stays on-box | QA doc: **8 GB** fits Gate A only; **12 Java + Kafka** needs headroom for 4 towns |
| **Prod database** | **Lightsail PostgreSQL** (Standard, e.g. 8 GB RAM tier) | Do **not** run prod Postgres only inside the VM without managed backups |
| **HTTPS** | **Lightsail LB** + attach cert (Let’s Encrypt or imported) | Razorpay webhooks need public HTTPS |
| **QA** | Separate **8 GB** instance | Never share prod DB or secrets |
| **Static IP** | Attach to prod instance | Stable DNS |

### Lightsail prod — monthly estimate (Mumbai, indicative)

Check [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/) — bundles change slightly by region.

| Item | USD / mo (range) |
|------|------------------|
| Instance **16 GB** | ~$84 |
| Instance **32 GB** (safer) | ~$164 |
| Managed PostgreSQL **Standard ~8 GB** | ~$55 – $115 |
| Load balancer | ~$18 |
| Static IP (attached) | $0 |
| S3 + transfer + Route 53 | ~$10 – $30 |
| **Total (16 GB app + DB + LB)** | **~$170 – $230** |
| **Total (32 GB app + DB + LB)** | **~$250 – $310** |

**INR @ ₹84/USD:** roughly **₹14k – ₹26k / month** (prod only, no QA).

Often **cheaper than EC2 + RDS + ALB** for the same pilot; you trade **less VPC flexibility** and a **harder path to Multi-AZ**.

### Lightsail prod — limitations (read before you choose)

| Topic | Lightsail prod |
|-------|----------------|
| **Multi-AZ / failover** | No real AZ failover; snapshot + restore runbook |
| **12 microservices + Kafka** | One box; scale = bigger bundle or migrate to EC2/EKS |
| **OpenSearch / MSK** | Not on Lightsail — defer (same as EC2 pilot) |
| **WAF** | Use CloudFront + WAF in front later, or migrate to ALB on EC2 |
| **Secrets** | Env files on VM (locked down) or call **Secrets Manager** from app (works) |
| **Compliance “RDS”** | Lightsail managed DB **is** managed Postgres with backups — document it in processor list |
| **Razorpay webhook** | `https://api.yourdomain.in/...` → LB → nginx → gateway |

### When to move off Lightsail prod

- Sustained CPU/RAM pressure across 4+ towns  
- Need **Multi-AZ RDS**, private subnets, WAF on ALB  
- 24+ towns or compliance audit requiring standard VPC architecture  

Migration: new EC2/RDS, restore DB dump, cut DNS.

---

## Architecture A — EC2 + RDS (Single-AZ pilot prod)

```text
Internet
   │
   ▼
Route 53  (app / vendor / hub / admin / api .yourdomain.in)
   │
   ▼
Application Load Balancer  +  ACM (HTTPS)
   │
   ▼
EC2 (public subnet, SG: only from ALB + your admin IP for SSH)
   │  Docker Compose: api-gateway + 12 Java services + Kafka/ZK + Redis (optional) + nginx → web static
   │
   ├──► RDS PostgreSQL 16  (private subnet, Single-AZ)  — all service DBs
   ├──► ElastiCache Redis  (private subnet, optional but recommended)
   ├──► S3 private bucket   (media proofs)
   └──► Secrets Manager     (JWT, DB, Razorpay, MSG91, …)
```

**Not in pilot month-1:** EKS, MSK, OpenSearch, NAT Gateway (EC2 public + ALB only; RDS/Redis private), WAF (add before heavy marketing).

---

## AWS components

| # | Service | Pilot spec | Notes |
|---|---------|------------|--------|
| 1 | **Route 53** | 1 hosted zone | Domain at GoDaddy OK; use Route 53 for DNS or delegate NS |
| 2 | **ACM** | Certs on ALB | Free |
| 3 | **ALB** | Internet-facing | Host rules → EC2; webhook on `api.*` |
| 4 | **EC2** | **m7i-flex.2xlarge** (8 vCPU, 32 GiB) on-demand | Same stack pattern as `docker-compose.qa.yml`; 16 GiB is tight |
| 5 | **EBS** | 120 GB **gp3** | Docker images, logs; monitor disk |
| 6 | **RDS** | **db.t4g.large**, PostgreSQL 16, **Single-AZ**, 100 GB gp3 | Multi-DB init: `infra/postgres/init-databases.sql`; automated backups 7–14 days |
| 7 | **ElastiCache** | **cache.t4g.micro** Redis 7 | Gateway rate limit / cache; or Redis in Compose to save ~$12/mo (less conservative) |
| 8 | **S3** | 1 bucket, block public access, SSE-S3 | `ap-south-1`; media-service signed URLs |
| 9 | **Secrets Manager** | 8–12 secrets | No secrets in git |
| 10 | **CloudWatch** | Logs + alarms (CPU, disk, RDS storage, ALB 5xx) | |
| 11 | **VPC** | 1 VPC, 2 subnets (1 public EC2, 1 private RDS) | Single-AZ placement for RDS in one AZ |

### Optional QA (recommended)

| Service | Spec | Cost |
|---------|------|------|
| **Lightsail** 8 GB Ubuntu | Gate A / remote testers | ~$44/mo |
| Or small **EC2 t4g.large** | Same Compose as QA | ~$30–40/mo |

**Never** reuse QA `.env` or DB for prod live UPI.

---

## DNS (example)

| Hostname | Use |
|----------|-----|
| `api.<domain>` | API gateway — Razorpay webhook `…/api/v1/payments/webhooks/razorpay` |
| `app.<domain>` | Buyer web |
| `vendor.<domain>` | Vendor portal |
| `hub.<domain>` | Delivery portal |
| `admin.<domain>` | Super-admin — restrict source IP or VPN |

---

## Monthly cost estimate (Single-AZ, ap-south-1)

On-demand, 24×7, **light–moderate** traffic for 4 towns. Verify in [AWS Pricing Calculator](https://calculator.aws/) before commit. GST may apply on AWS India bill.

| Line item | USD / month (planning range) |
|-----------|------------------------------|
| EC2 m7i-flex.2xlarge | $130 – $155 |
| EBS 120 GB gp3 | $10 – $12 |
| RDS db.t4g.large **Single-AZ** + 100 GB | $95 – $120 |
| ElastiCache cache.t4g.micro | $12 – $15 |
| ALB + LCUs | $20 – $35 |
| S3 + requests | $5 – $20 |
| Route 53, Secrets, CloudWatch, transfer | $15 – $40 |
| **Prod subtotal** | **~$290 – $400** |
| QA Lightsail 8 GB (optional) | +$44 |

**INR (indicative @ ₹84/USD):** **~₹24,000 – ₹34,000 / month** prod only (+ QA ~₹3,700).

**Cheaper knobs (if needed):**

| Change | Saves | Trade-off |
|--------|--------|-----------|
| EC2 **m7i-flex.xlarge** (16 GiB) | ~$70/mo | Less headroom for 12 JVMs + Kafka |
| Redis on EC2 only (no ElastiCache) | ~$12/mo | You manage persistence/failover |
| RDS **db.t4g.medium** | ~$40/mo | Watch CPU/storage as towns grow |

---

## Single-AZ risks (accept consciously)

| Risk | Mitigation |
|------|------------|
| AZ outage in Mumbai | RDS unavailable until AZ recovers; no automatic failover |
| RDS failure | Restore from **automated snapshot** (test restore once before launch) |
| Single EC2 | Compose restart; AMI snapshot weekly; deploy runbook |

**Upgrade trigger:** Multi-AZ RDS + second app instance when you have **sustained revenue** or **SLA promises** to vendors/hubs.

---

## Pre-launch checklist (hosting)

- [ ] AWS account, MFA, billing budget alert (~₹20k–35k/mo)
- [ ] Domain registered; Route 53 records to ALB
- [ ] ACM validated; HTTPS only
- [ ] RDS created; apps use RDS endpoint (not Postgres container in prod)
- [ ] Secrets in Secrets Manager; JWT rotated; no OTP `111111` on prod
- [ ] S3 bucket + IAM role for media-service
- [ ] Razorpay webhook → `https://api.<domain>/api/v1/payments/webhooks/razorpay`
- [ ] Security groups: ALB → EC2 only; RDS/Redis from EC2 SG only
- [ ] CloudWatch alarm → SMS/email for disk & 5xx
- [ ] Backup: RDS retention ≥ 7 days; document restore steps

---

## Deploy approach (matches repo today)

1. Build images on EC2 or CI → pull on VM (see `infra/docker/Dockerfile.java`, `Dockerfile.web`).
2. Start from **`docker-compose.qa.yml`** pattern but:
   - `SPRING_DATASOURCE_URL` → **RDS** (each service DB name unchanged)
   - Remove **postgres** service from prod compose
   - Prod `.env` from Secrets Manager / SSM — **not** committed
3. Nginx on EC2 (see `infra/nginx/qa.conf`) — extend for 4 hostnames behind ALB.

**Future:** `docker-compose.prod.yml` + Terraform in `infra/` (not required for first pilot if Compose is documented).

---

## Hosting evolution policy (VPS → AWS)

**Decision rule:** Use **Hostinger (or similar VPS) for early production** while the business is small. **Plan and execute migration to AWS `ap-south-1`** when the platform is commercially real—**target around ~50 enabled towns with healthy GMV**, or earlier if capacity metrics force it.

### This does **not** break production at town 50

| Question | Answer |
|----------|--------|
| Is there a **hard cap** at 50 towns in code? | **No.** Town creation and buyer/vendor flows are **not** blocked by town count. Town **51** does not fail because of this policy. |
| Does prod **shut off** automatically at 50 towns? | **No.** Nothing in the application enforces hosting provider or town limits. |
| What **does** happen at ~50 towns? | **Ops/business trigger:** schedule AWS migration, budget, and runbooks—not an automatic cutover. |
| Can we stay on VPS past 50 towns? | **Yes**, if metrics are comfortable and risk is accepted—but **plan** AWS before load, payouts, and uptime expectations outgrow one provider/VM. |

**Production keeps running on the current host** until a **planned** migration finishes (RDS restore/cutover, DNS to ALB, webhook smoke tests). Treat migration like a **release window**, not a cliff edge.

### Migrate to AWS when **any** of these is true

- **~50 towns** enabled and operating with real orders (default trigger).
- **Sustained load pain** on VPS (RAM/CPU, DB on same box, checkout/webhook lag, Kafka lag)—**even below 50 towns**.
- **Revenue / COD / UPI volume** where multi-hour outage is unacceptable.
- **Compliance or partners** require Multi-AZ DB, WAF, or documented DR.

### Migrate **early** (before 50) if needed

Do not wait for an arbitrary town count if the **VPS is already saturated**. Town count and order rate are **independent** (many light towns vs few heavy towns).

### What stays the same in AWS

Same **git repo**, **services**, **Flyway schemas**, **API paths**, and (ideally) the same **public API hostname** for Razorpay webhooks. Change **endpoints and secrets**, not business rules—see [Deploy approach](#deploy-approach-matches-repo-today) above.

### VPS prod checklist (until AWS)

- Nightly **Postgres backups off-server**; test restore at least once.
- **Separate DB VPS** from app when affordable (easier RDS cutover later).
- **No prod secrets in git**; use `docs/QA_SECURITY_CHECKLIST.md` before promote.
- Monitor disk, RAM, 5xx, payment webhook failures.

---

## Related docs

| Doc | Topic |
|-----|--------|
| [infra/qa/README.md](../infra/qa/README.md) | Phase 1 local + Lightsail QA |
| [08_GO_LIVE_PLAN.md](./08_GO_LIVE_PLAN.md) | Product go-live |
| [legal/DATA_RETENTION_AND_PROCESSORS.md](./legal/DATA_RETENTION_AND_PROCESSORS.md) | AWS as processor |
